#!/usr/bin/env node
/**
 * Transcribe fallback for SharePoint videos lacking auto-generated transcripts.
 * Downloads video → extracts audio → S3 → AWS Transcribe (custom vocab) → VTT.
 *
 * Usage: node /opt/scripts/transcribe-fallback.mjs
 * Env: CANVAS_API_TOKEN, CANVAS_COURSE_ID, MS_EMAIL, MS_PASSWORD, AWS_REGION
 *
 * Output: /workspace/extra/course-materials/transcripts/{week}--{title}.vtt
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer-core';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  CreateVocabularyCommand,
  GetVocabularyCommand,
  DeleteVocabularyCommand,
} from '@aws-sdk/client-transcribe';

const S3_BUCKET = 'tai-backups-prod';
const S3_SESSION_KEY = 'ms-session.json';
const S3_AUDIO_PREFIX = 'transcribe-input';
const CANVAS_BASE = 'https://northeastern.instructure.com/api/v1';
const OUTPUT_DIR = '/workspace/extra/course-materials/transcripts';
const TEMP_DIR = '/workspace/extra/tmp-transcribe';
const REGION = process.env.AWS_REGION || 'us-west-2';

const VOCABULARY_NAME = 'tai-cs6650';
// Transcribe Phrases: each entry is a single word or hyphenated pronunciation hint.
// Multi-word terms use hyphens as pronunciation separators.
const CUSTOM_VOCABULARY = [
  'CS-six-six-fifty', 'Piazza', 'Yvonne', 'Coady', 'Northeastern',
  'Paxos', 'Raft', 'MapReduce', 'Zookeeper', 'etcd', 'Kafka', 'Cassandra',
  'DynamoDB', 'MongoDB', 'Redis',
  'goroutine', 'goroutines', 'Golang', 'Gin', 'mutex', 'WaitGroup',
  'Terraform', 'Docker', 'Kubernetes',
  'gRPC', 'linearizability', 'quorum', 'sharding', 'partitioning',
  'microservices', 'Locust',
];

const s3 = new S3Client({ region: REGION });
const transcribe = new TranscribeClient({ region: REGION });

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

async function loadSession() {
  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: S3_SESSION_KEY }));
    return JSON.parse(await resp.Body.transformToString());
  } catch { return null; }
}

async function saveSession(cookies) {
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: S3_SESSION_KEY,
    Body: JSON.stringify(cookies), ContentType: 'application/json',
  }));
}

async function fetchCanvasModules() {
  const token = process.env.CANVAS_API_TOKEN;
  const courseId = process.env.CANVAS_COURSE_ID;
  if (!token || !courseId) throw new Error('CANVAS_API_TOKEN and CANVAS_COURSE_ID required');

  let all = [];
  let nextUrl = CANVAS_BASE + '/courses/' + courseId + '/modules?include[]=items&per_page=50';
  while (nextUrl) {
    const resp = await fetch(nextUrl, { headers: { Authorization: 'Bearer ' + token } });
    if (!resp.ok) throw new Error('Canvas ' + resp.status);
    all.push(...await resp.json());
    const link = resp.headers.get('link') || '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = next ? next[1] : null;
  }
  return all;
}

function findVideosWithoutTranscripts(modules) {
  const videos = [];
  for (const mod of modules) {
    for (const item of (mod.items || [])) {
      if (item.type === 'ExternalUrl' && item.external_url && item.external_url.includes('northeastern-my.sharepoint.com')) {
        const filename = slugify(mod.name) + '--' + slugify(item.title) + '.vtt';
        if (!fs.existsSync(path.join(OUTPUT_DIR, filename))) {
          videos.push({ url: item.external_url, title: item.title, moduleName: mod.name, filename });
        }
      }
    }
  }
  return videos;
}

async function authenticateIfNeeded(page, email, password) {
  if (!page.url().includes('login.microsoftonline.com') && !page.url().includes('login.live.com')) return false;

  process.stderr.write('[auth] Login redirect, authenticating...\n');
  await page.waitForSelector('input[type="email"], input[name="loginfmt"]', { timeout: 10000 });
  await page.type('input[type="email"], input[name="loginfmt"]', email, { delay: 50 });
  await page.click('input[type="submit"], #idSIButton9');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

  await page.waitForSelector('#i0118, input[name="passwd"]', { timeout: 15000, visible: true });
  await new Promise(r => setTimeout(r, 1000));
  await page.type('#i0118, input[name="passwd"]', password, { delay: 80 });
  await page.click('#idSIButton9');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

  await new Promise(r => setTimeout(r, 3000));
  const isDuo = page.url().includes('duosecurity.com') ||
    await page.$('iframe[src*="duosecurity.com"]').then(f => !!f).catch(() => false);

  if (isDuo) {
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    const codeMatch = pageText.match(/\b(\d{3})\s+(\d{3})\b/);
    if (codeMatch) process.stderr.write('[auth] Duo code: ' + codeMatch[1] + ' ' + codeMatch[2] + '\n');
    else process.stderr.write('[auth] Duo — waiting for push...\n');
    await page.waitForFunction(
      () => !window.location.href.includes('duosecurity.com') && !window.location.href.includes('login.microsoftonline.com'),
      { timeout: 120000 }
    ).catch(() => {});

    await page.evaluate(() => {
      const cb = document.querySelector('input[name="dampen_choice"]') || document.querySelector('input[type="checkbox"]');
      if (cb && !cb.checked) cb.click();
    });

    const trustBtn = await page.$('button::-p-text("Yes, this is my device")').catch(() => null) ||
      await page.evaluateHandle(() => {
        const btns = [...document.querySelectorAll('button')];
        return btns.find(b => b.textContent.includes('Yes')) || null;
      }).then(h => h.asElement()).catch(() => null);
    if (trustBtn) {
      await trustBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    }
  }

  const stayBtn = await page.$('#idSIButton9, input[value="Yes"]');
  if (stayBtn) {
    const dontShow = await page.$('#KmsiCheckboxField, input[name="DontShowAgain"]');
    if (dontShow) await dontShow.evaluate(el => { if (!el.checked) el.click(); });
    await stayBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  }
  return true;
}

async function downloadVideo(browser, videoUrl, cookies, email, password, outputPath) {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Encoding': 'identity' });
  if (cookies) await page.setCookie(...cookies);

  let bearerToken = null;
  const client = await page.createCDPSession();
  await client.send('Network.enable');
  client.on('Network.requestWillBeSent', (p) => {
    if (p.request.url.includes('cdnmedia') && !bearerToken) {
      bearerToken = p.request.headers['x-authorization'] || p.request.headers['Authorization'];
    }
  });

  await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  const didAuth = await authenticateIfNeeded(page, email, password);
  if (didAuth) {
    const fresh = await page.cookies();
    if (fresh.length > 0) await saveSession(fresh);
  }

  await new Promise(r => setTimeout(r, 15000));
  if (!bearerToken) { await page.close(); throw new Error('no bearer token captured'); }

  const html = await page.content();
  const driveMatch = html.match(/drives\/(b![a-zA-Z0-9_-]{40,})/);
  const itemMatch = html.match(/items\/([A-Z0-9]{30,})/);
  if (!driveMatch || !itemMatch) { await page.close(); throw new Error('could not extract drive/item IDs'); }

  const siteBase = new URL(page.url()).origin + '/personal/m_coady_northeastern_edu';
  await page.close();

  const contentUrl = siteBase + '/_api/v2.1/drives/' + driveMatch[1] + '/items/' + itemMatch[1] + '/content';
  process.stderr.write('[download] fetching video...\n');
  const dlResp = await fetch(contentUrl, { headers: { Authorization: bearerToken }, redirect: 'follow' });
  if (!dlResp.ok) throw new Error('download failed: ' + dlResp.status);

  const contentLength = dlResp.headers.get('content-length');
  process.stderr.write('[download] size: ' + (parseInt(contentLength || 0) / 1024 / 1024).toFixed(0) + ' MB\n');

  // Stream to file to avoid loading full video into memory
  const writer = fs.createWriteStream(outputPath);
  const reader = dlResp.body.getReader();
  let downloaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    writer.write(value);
    downloaded += value.length;
  }
  writer.end();
  await new Promise(resolve => writer.on('finish', resolve));
  process.stderr.write('[download] saved ' + (downloaded / 1024 / 1024).toFixed(0) + ' MB\n');
}

function extractAudio(videoPath, audioPath) {
  process.stderr.write('[ffmpeg] extracting audio (16kHz mono)...\n');
  execSync('ffmpeg -y -i "' + videoPath + '" -ac 1 -ar 16000 -f wav "' + audioPath + '" 2>/dev/null');
  fs.unlinkSync(videoPath);
  const size = fs.statSync(audioPath).size;
  process.stderr.write('[ffmpeg] audio: ' + (size / 1024 / 1024).toFixed(0) + ' MB\n');
}

async function uploadToS3(audioPath, key) {
  process.stderr.write('[s3] uploading ' + key + '...\n');
  // Stream upload for large files
  const stream = fs.createReadStream(audioPath);
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: key, Body: stream, ContentType: 'audio/wav',
  }));
  fs.unlinkSync(audioPath);
  process.stderr.write('[s3] done\n');
}

async function ensureVocabulary() {
  try {
    const resp = await transcribe.send(new GetVocabularyCommand({ VocabularyName: VOCABULARY_NAME }));
    if (resp.VocabularyState === 'READY') {
      process.stderr.write('[vocab] ' + VOCABULARY_NAME + ' ready\n');
      return;
    }
    if (resp.VocabularyState === 'PENDING') {
      process.stderr.write('[vocab] pending, waiting...\n');
      await waitForVocabulary();
      return;
    }
    if (resp.VocabularyState === 'FAILED') {
      process.stderr.write('[vocab] previous vocab failed, deleting and recreating...\n');
      await transcribe.send(new DeleteVocabularyCommand({ VocabularyName: VOCABULARY_NAME }));
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    if (!e.name?.includes('NotFound') && !e.message?.includes('not found') && !e.name?.includes('BadRequestException')) throw e;
  }

  process.stderr.write('[vocab] creating ' + VOCABULARY_NAME + '...\n');
  await transcribe.send(new CreateVocabularyCommand({
    VocabularyName: VOCABULARY_NAME,
    LanguageCode: 'en-US',
    Phrases: CUSTOM_VOCABULARY,
  }));
  await waitForVocabulary();
}

async function waitForVocabulary() {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const resp = await transcribe.send(new GetVocabularyCommand({ VocabularyName: VOCABULARY_NAME }));
    if (resp.VocabularyState === 'READY') return;
    if (resp.VocabularyState === 'FAILED') {
      process.stderr.write('[vocab] failure reason: ' + (resp.FailureReason || 'unknown') + '\n');
      throw new Error('vocabulary creation failed: ' + (resp.FailureReason || 'unknown'));
    }
  }
  throw new Error('vocabulary timeout');
}

async function startTranscribeJob(s3Key, jobName) {
  process.stderr.write('[transcribe] starting job: ' + jobName + '\n');
  await transcribe.send(new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    LanguageCode: 'en-US',
    Media: { MediaFileUri: 's3://' + S3_BUCKET + '/' + s3Key },
    Settings: { VocabularyName: VOCABULARY_NAME },
    OutputBucketName: S3_BUCKET,
    OutputKey: 'transcribe-output/' + jobName + '.json',
    Subtitles: { Formats: ['vtt'], OutputStartIndex: 1 },
  }));
}

async function waitForJob(jobName) {
  for (let i = 0; i < 360; i++) { // up to 30 min (long lectures)
    await new Promise(r => setTimeout(r, 5000));
    const resp = await transcribe.send(new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }));
    const status = resp.TranscriptionJob.TranscriptionJobStatus;
    if (status === 'COMPLETED') return resp.TranscriptionJob;
    if (status === 'FAILED') throw new Error('transcribe failed: ' + resp.TranscriptionJob.FailureReason);
    if (i % 12 === 0 && i > 0) process.stderr.write('[transcribe] ' + jobName.slice(0, 40) + ': ' + status + ' (' + (i * 5) + 's)\n');
  }
  throw new Error('transcribe job timeout (30 min)');
}

async function downloadVtt(jobName) {
  // Transcribe Subtitles output goes to: transcribe-output/{jobName}.vtt
  const vttKey = 'transcribe-output/' + jobName + '.vtt';
  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: vttKey }));
    return await resp.Body.transformToString();
  } catch {
    // Fallback: build VTT from JSON transcript
    const jsonKey = 'transcribe-output/' + jobName + '.json';
    const resp = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: jsonKey }));
    const data = JSON.parse(await resp.Body.transformToString());
    return buildVttFromJson(data);
  }
}

function buildVttFromJson(data) {
  const items = data.results?.items || [];
  let vtt = 'WEBVTT\n\n';
  let cueNum = 1;
  let text = [];
  let start = null;
  let end = null;

  for (const item of items) {
    if (item.type === 'pronunciation') {
      if (start === null) start = parseFloat(item.start_time);
      end = parseFloat(item.end_time);
      text.push(item.alternatives[0]?.content || '');
    } else if (item.type === 'punctuation') {
      text.push(item.alternatives[0]?.content || '');
    }

    if (end !== null && start !== null && (end - start > 10 ||
        (item.type === 'punctuation' && '.!?'.includes(item.alternatives[0]?.content || '')))) {
      vtt += cueNum + '\n' + fmtTime(start) + ' --> ' + fmtTime(end) + '\n';
      vtt += text.join(' ').replace(/ ([.,!?;:])/g, '$1') + '\n\n';
      cueNum++;
      text = [];
      start = null;
      end = null;
    }
  }
  if (text.length > 0 && start !== null) {
    vtt += cueNum + '\n' + fmtTime(start) + ' --> ' + fmtTime(end || start) + '\n';
    vtt += text.join(' ').replace(/ ([.,!?;:])/g, '$1') + '\n\n';
  }
  return vtt;
}

function fmtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = (sec % 60).toFixed(3);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + s.padStart(6, '0');
}

// ─── Main ───────────────────────────────────────────────────────────────────

const email = process.env.MS_EMAIL;
const password = process.env.MS_PASSWORD;
if (!email || !password) { console.error('MS_EMAIL and MS_PASSWORD required'); process.exit(1); }

process.stderr.write('[main] Fetching Canvas modules...\n');
const modules = await fetchCanvasModules();
const videos = findVideosWithoutTranscripts(modules);
process.stderr.write('[main] ' + videos.length + ' video(s) without transcripts\n');

if (videos.length === 0) {
  console.log('All videos already have transcripts.');
  process.exit(0);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

await ensureVocabulary();

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure', '--disable-web-security'],
});

let fetched = 0, failed = 0;
const failures = [];
const cookies = await loadSession();

try {
  for (const video of videos) {
    process.stderr.write('\n[video] ' + video.moduleName + ' / ' + video.title + '\n');
    const slug = video.filename.replace('.vtt', '');
    try {
      // 1. Download video (to mounted volume, not /tmp which is 512MB)
      const videoPath = path.join(TEMP_DIR, slug + '.mp4');
      await downloadVideo(browser, video.url, cookies, email, password, videoPath);

      // 2. Extract audio
      const audioPath = path.join(TEMP_DIR, slug + '.wav');
      extractAudio(videoPath, audioPath);

      // 3. Upload audio to S3
      const s3Key = S3_AUDIO_PREFIX + '/' + slug + '.wav';
      await uploadToS3(audioPath, s3Key);

      // 4. Start Transcribe job (with timestamp for uniqueness)
      const jobName = 'tai-' + slug.slice(0, 180) + '-' + Date.now();
      await startTranscribeJob(s3Key, jobName);

      // 5. Wait for completion
      await waitForJob(jobName);

      // 6. Download VTT
      const vtt = await downloadVtt(jobName);
      const outPath = path.join(OUTPUT_DIR, video.filename);
      fs.writeFileSync(outPath, vtt, 'utf-8');
      process.stderr.write('[done] ' + video.filename + ' (' + vtt.length + ' bytes)\n');
      fetched++;
    } catch (e) {
      process.stderr.write('[fail] ' + video.title + ': ' + e.message + '\n');
      failures.push({ title: video.title, module: video.moduleName, error: e.message });
      failed++;
      // Clean up any temp files
      for (const ext of ['.mp4', '.wav']) {
        const p = path.join(TEMP_DIR, slug + ext);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
  }
} finally {
  await browser.close();
  // Clean up temp dir
  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true });
}

console.log('\n=== Transcribe Fallback Summary ===');
console.log('Videos processed: ' + videos.length);
console.log('Transcribed: ' + fetched);
console.log('Failed: ' + failed);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  - [' + f.module + '] ' + f.title + ': ' + f.error);
}
