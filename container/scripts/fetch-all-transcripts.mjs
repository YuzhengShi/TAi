#!/usr/bin/env node
/**
 * Bulk SharePoint transcript fetcher.
 * Iterates Canvas modules, finds SharePoint video links, downloads VTT transcripts.
 *
 * Usage: node /opt/scripts/fetch-all-transcripts.mjs
 * Env: CANVAS_API_TOKEN, CANVAS_COURSE_ID, MS_EMAIL, MS_PASSWORD, AWS_REGION
 */
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const S3_BUCKET = 'tai-backups-prod';
const S3_KEY = 'ms-session.json';
const CANVAS_BASE = 'https://northeastern.instructure.com/api/v1';
const OUTPUT_DIR = '/workspace/extra/course-materials/transcripts';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

async function loadSession() {
  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: S3_KEY }));
    const body = await resp.Body.transformToString();
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function saveSession(cookies) {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: S3_KEY,
      Body: JSON.stringify(cookies),
      ContentType: 'application/json',
    }));
  } catch (e) {
    process.stderr.write(`[session] save failed: ${e.message}\n`);
  }
}

async function fetchCanvasModules() {
  const token = process.env.CANVAS_API_TOKEN;
  const courseId = process.env.CANVAS_COURSE_ID;
  if (!token || !courseId) {
    throw new Error('CANVAS_API_TOKEN and CANVAS_COURSE_ID required');
  }

  let allModules = [];
  let url = `${CANVAS_BASE}/courses/${courseId}/modules?include[]=items&per_page=50`;

  while (url) {
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`Canvas API ${resp.status}: ${await resp.text()}`);
    const modules = await resp.json();
    allModules.push(...modules);

    const link = resp.headers.get('link') || '';
    const nextMatch = link.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  return allModules;
}

function extractSharePointVideos(modules) {
  const videos = [];
  for (const mod of modules) {
    const weekSlug = slugify(mod.name);
    for (const item of (mod.items || [])) {
      if (item.type === 'ExternalUrl' && item.external_url &&
          item.external_url.includes('northeastern-my.sharepoint.com')) {
        videos.push({
          url: item.external_url,
          title: item.title,
          weekSlug,
          moduleName: mod.name,
          filename: `${weekSlug}--${slugify(item.title)}.vtt`,
        });
      }
    }
  }
  return videos;
}

async function authenticateIfNeeded(page, email, password) {
  if (!page.url().includes('login.microsoftonline.com') &&
      !page.url().includes('login.live.com')) {
    return false;
  }

  process.stderr.write('[auth] Login redirect detected, authenticating...\n');

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
    if (codeMatch) {
      process.stderr.write(`[auth] Duo verification code: ${codeMatch[1]} ${codeMatch[2]}\n`);
    } else {
      process.stderr.write('[auth] Duo MFA detected — waiting for push approval...\n');
    }
    process.stderr.write('[auth] Waiting up to 120s for approval...\n');
    await page.waitForFunction(
      () => !window.location.href.includes('duosecurity.com') &&
            !window.location.href.includes('login.microsoftonline.com') &&
            !window.location.href.includes('login.live.com'),
      { timeout: 120000 }
    ).catch(() => {});

    const rememberChecked = await page.evaluate(() => {
      const checkbox = document.querySelector('input[name="dampen_choice"]') ||
        document.querySelector('input[name="remember_me"]') ||
        document.querySelector('#remember-me-checkbox') ||
        document.querySelector('input[type="checkbox"]');
      if (checkbox && !checkbox.checked) { checkbox.click(); return 'clicked'; }
      if (checkbox && checkbox.checked) return 'already-checked';
      const labels = [...document.querySelectorAll('label, span, div')];
      const rememberLabel = labels.find(el =>
        (el.textContent || '').toLowerCase().includes('remember') ||
        (el.textContent || '').toLowerCase().includes('30 day'));
      if (rememberLabel) { rememberLabel.click(); return 'clicked-label'; }
      return 'not-found';
    });
    process.stderr.write(`[auth] Remember me: ${rememberChecked}\n`);

    const trustBtn = await page.$('button::-p-text("Yes, this is my device")').catch(() => null) ||
      await page.evaluateHandle(() => {
        const btns = [...document.querySelectorAll('button')];
        return btns.find(b => b.textContent.includes('Yes')) || null;
      }).then(h => h.asElement()).catch(() => null);
    if (trustBtn) {
      await trustBtn.click();
      process.stderr.write('[auth] Clicked "Yes, this is my device"\n');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    }
  }

  const dontShowAgain = await page.$('#KmsiCheckboxField, input[name="DontShowAgain"]');
  if (dontShowAgain) {
    const isChecked = await dontShowAgain.evaluate(el => el.checked);
    if (!isChecked) await dontShowAgain.click();
  }
  const staySignedIn = await page.$('#idSIButton9, input[value="Yes"]');
  if (staySignedIn) {
    await staySignedIn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  }

  await page.waitForFunction(
    () => !window.location.href.includes('login.microsoftonline.com') &&
          !window.location.href.includes('login.live.com'),
    { timeout: 15000 }
  ).catch(() => {});

  return true;
}

async function fetchTranscript(browser, videoUrl, cookies, email, password) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
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
    const freshCookies = await page.cookies();
    if (freshCookies.length > 0) await saveSession(freshCookies);
  }

  // Wait for Stream to load and fire media requests
  await new Promise(r => setTimeout(r, 15000));

  let vtt = null;
  if (bearerToken) {
    const pageHtml = await page.content();
    const driveMatch = pageHtml.match(/drives\/(b![a-zA-Z0-9_-]{40,})/);
    const itemMatch = pageHtml.match(/items\/([A-Z0-9]{30,})/);

    if (driveMatch && itemMatch) {
      const driveId = driveMatch[1];
      const itemId = itemMatch[1];
      const siteBase = new URL(page.url()).origin + '/personal/m_coady_northeastern_edu';
      const hdrs = {
        'Authorization': bearerToken,
        'Accept': 'application/json',
        'Accept-Encoding': 'identity',
      };

      const listResp = await fetch(
        `${siteBase}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts`,
        { headers: hdrs }
      );
      if (listResp.ok) {
        const listJson = await listResp.json();
        const transcripts = listJson.value || [];
        const target = transcripts.find(t => t.isDefault) || transcripts[0];
        if (target) {
          const contentResp = await fetch(
            `${siteBase}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts/${target.id}/content`,
            { headers: { ...hdrs, 'Accept': 'text/vtt, */*' } }
          );
          if (contentResp.ok) {
            vtt = await contentResp.text();
          } else {
            throw new Error(`transcript content ${contentResp.status}`);
          }
        } else {
          throw new Error('no transcripts found for this video');
        }
      } else {
        throw new Error(`transcript list ${listResp.status}`);
      }
    } else {
      throw new Error('could not extract drive/item IDs from page');
    }
  } else {
    throw new Error('no bearer token captured');
  }

  await page.close();
  return vtt;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const email = process.env.MS_EMAIL;
const password = process.env.MS_PASSWORD;
if (!email || !password) {
  console.error('Error: MS_EMAIL and MS_PASSWORD required');
  process.exit(1);
}

process.stderr.write('[main] Fetching Canvas modules...\n');
const modules = await fetchCanvasModules();
const videos = extractSharePointVideos(modules);
process.stderr.write(`[main] Found ${videos.length} SharePoint video(s) across ${modules.length} modules\n`);

if (videos.length === 0) {
  console.log('No SharePoint videos found in Canvas modules.');
  process.exit(0);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

let fetched = 0, skipped = 0, failed = 0;
const failures = [];

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
    '--disable-web-security',
  ],
});

try {
  const cookies = await loadSession();

  for (const video of videos) {
    const outPath = path.join(OUTPUT_DIR, video.filename);

    if (fs.existsSync(outPath)) {
      process.stderr.write(`[skip] ${video.filename}\n`);
      skipped++;
      continue;
    }

    process.stderr.write(`[fetch] ${video.moduleName} / ${video.title}\n`);
    try {
      const vtt = await fetchTranscript(browser, video.url, cookies, email, password);
      fs.writeFileSync(outPath, vtt, 'utf-8');
      process.stderr.write(`[done] ${video.filename} (${vtt.length} bytes)\n`);
      fetched++;
    } catch (e) {
      process.stderr.write(`[fail] ${video.title}: ${e.message}\n`);
      failures.push({ title: video.title, module: video.moduleName, error: e.message });
      failed++;
    }
  }
} finally {
  await browser.close();
}

// Summary
console.log('\n=== Transcript Fetch Summary ===');
console.log(`Total videos: ${videos.length}`);
console.log(`Fetched: ${fetched}`);
console.log(`Skipped (already exist): ${skipped}`);
console.log(`Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - [${f.module}] ${f.title}: ${f.error}`);
  }
}
