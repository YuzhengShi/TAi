#!/usr/bin/env node
/**
 * Microsoft-authenticated SharePoint browser.
 * Usage: node /opt/scripts/ms-auth-browse.mjs <url>
 *
 * Reads MS_EMAIL and MS_PASSWORD from environment.
 * Persists session cookies to S3 so Duo MFA only needed once.
 */
import fs from 'fs';
import puppeteer from 'puppeteer-core';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const S3_BUCKET = 'tai-backups-prod';
const S3_KEY = 'ms-session.json';
const LOCAL_SESSION = '/tmp/ms-session.json';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });

const url = process.argv[2];
if (!url) {
  console.error('Usage: node ms-auth-browse.mjs <url>');
  process.exit(1);
}

const email = process.env.MS_EMAIL;
const password = process.env.MS_PASSWORD;
if (!email || !password) {
  console.error('Error: MS_EMAIL and MS_PASSWORD environment variables required');
  process.exit(1);
}

// Try to load saved session from S3
async function loadSession() {
  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: S3_KEY }));
    const body = await resp.Body.transformToString();
    const cookies = JSON.parse(body);
    console.error('[auth] Session loaded from S3');
    return cookies;
  } catch {
    console.error('[auth] No session found, fresh login required');
    return null;
  }
}

// Save session to S3 after successful auth
async function saveSession(cookies) {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: S3_KEY,
      Body: JSON.stringify(cookies),
      ContentType: 'application/json',
    }));
    console.error('[auth] Session saved to S3');
  } catch (e) {
    console.error(`[auth] Failed to save session: ${e.message}`);
  }
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
    '--disable-web-security',
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Disable compression so transcript response is readable
  await page.setExtraHTTPHeaders({ 'Accept-Encoding': 'identity' });

  // Intercept transcript API responses (must be before goto)
  let transcriptBody = '';
  page.on('response', async (response) => {
    const u = response.url();
    if (u.includes('transcripts') && u.includes('cdnmedia')) {
      try {
        const buf = await response.buffer();
        const text = buf.toString('utf8');
        if (text.startsWith('{') || text.startsWith('[')) {
          transcriptBody = text;
        }
      } catch {}
    }
  });

  // Load saved cookies before navigating
  const savedCookies = await loadSession();
  if (savedCookies) {
    await page.setCookie(...savedCookies);
  }

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Check if redirected to Microsoft login (session expired or no session)
  let didAuth = false;
  if (page.url().includes('login.microsoftonline.com') || page.url().includes('login.live.com')) {
    didAuth = true;
    // Email step
    await page.waitForSelector('input[type="email"], input[name="loginfmt"]', { timeout: 10000 });
    await page.type('input[type="email"], input[name="loginfmt"]', email, { delay: 50 });
    await page.click('input[type="submit"], #idSIButton9');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

    // Password step
    await page.waitForSelector('#i0118, input[name="passwd"]', { timeout: 15000, visible: true });
    await new Promise(r => setTimeout(r, 1000));
    await page.type('#i0118, input[name="passwd"]', password, { delay: 80 });
    await page.click('#idSIButton9');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

    // Duo MFA — push is sent automatically, extract code and wait
    await new Promise(r => setTimeout(r, 3000));
    const isDuo = page.url().includes('duosecurity.com') ||
      await page.$('iframe[src*="duosecurity.com"]').then(f => !!f).catch(() => false);

    if (isDuo) {
      const pageText = await page.evaluate(() => document.body?.innerText || '');
      console.error('[auth] Duo page text: ' + pageText.replace(/\n/g, ' | ').slice(0, 300));
      const codeMatch = pageText.match(/\b(\d{3})\s+(\d{3})\b/);
      if (codeMatch) {
        console.error(`[auth] Duo verification code: ${codeMatch[1]} ${codeMatch[2]}`);
      } else {
        console.error('[auth] Duo MFA detected — waiting for push approval...');
      }
      console.error('[auth] Waiting up to 120s for approval...');
      await page.waitForFunction(
        () => !window.location.href.includes('duosecurity.com') &&
              !window.location.href.includes('login.microsoftonline.com') &&
              !window.location.href.includes('login.live.com'),
        { timeout: 120000 }
      ).catch(async () => {
        const currentUrl = page.url();
        if (!currentUrl.includes('duosecurity.com') &&
            !currentUrl.includes('login.microsoftonline.com')) {
          console.error('[auth] Duo approved — continuing');
        } else {
          // May still be on Duo "Is this your device?" page — try clicking through
          console.error('[auth] Duo timeout — checking for device trust prompt...');
        }
      });

      // Check "Remember me for 30 days" checkbox before device trust
      const rememberChecked = await page.evaluate(() => {
        // Try common Duo "remember me" selectors
        const checkbox = document.querySelector('input[name="dampen_choice"]') ||
          document.querySelector('input[name="remember_me"]') ||
          document.querySelector('#remember-me-checkbox') ||
          document.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.checked) {
          checkbox.click();
          return 'clicked';
        }
        if (checkbox && checkbox.checked) return 'already-checked';
        // Try label-based click (newer Duo UI uses custom checkboxes)
        const labels = [...document.querySelectorAll('label, span, div')];
        const rememberLabel = labels.find(el =>
          (el.textContent || '').toLowerCase().includes('remember') ||
          (el.textContent || '').toLowerCase().includes('30 day'));
        if (rememberLabel) {
          rememberLabel.click();
          return 'clicked-label';
        }
        return 'not-found';
      });
      console.error(`[auth] Remember me checkbox: ${rememberChecked}`);

      // Handle "Is this your device?" trust prompt (still on duosecurity.com)
      const trustBtn = await page.$('button::-p-text("Yes, this is my device")').catch(() => null) ||
        await page.evaluateHandle(() => {
          const btns = [...document.querySelectorAll('button')];
          return btns.find(b => b.textContent.includes('Yes')) || null;
        }).then(h => h.asElement()).catch(() => null);
      if (trustBtn) {
        await trustBtn.click();
        console.error('[auth] Clicked "Yes, this is my device"');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      }
    }

    // "Stay signed in?" prompt — check "Don't show this again" first
    const dontShowAgain = await page.$('#KmsiCheckboxField, input[name="DontShowAgain"]');
    if (dontShowAgain) {
      const isChecked = await dontShowAgain.evaluate(el => el.checked);
      if (!isChecked) {
        await dontShowAgain.click();
        console.error('[auth] Checked "Don\'t show this again"');
      }
    }
    const staySignedIn = await page.$('#idSIButton9, input[value="Yes"]');
    if (staySignedIn) {
      await staySignedIn.click();
      console.error('[auth] Clicked "Stay signed in"');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    }

    // Wait for final redirect to SharePoint
    await page.waitForFunction(
      () => !window.location.href.includes('login.microsoftonline.com') && !window.location.href.includes('login.live.com'),
      { timeout: 15000 }
    ).catch(() => {});
  }

  // Save session only when actually on SharePoint/target content (not login/Duo pages)
  const currentUrl = page.url();
  const onContent = !currentUrl.includes('login.microsoftonline.com') &&
    !currentUrl.includes('login.live.com') &&
    !currentUrl.includes('duosecurity.com');
  if (onContent) {
    const cookies = await page.cookies();
    if (cookies.length > 0) {
      await saveSession(cookies);
    }
  }

  // Wait for video player scripts to inject the pre-signed transcript CDN URL
  if (!transcriptBody) {
    try {
      await page.waitForFunction(
        () => [...document.querySelectorAll('script')].some(s => (s.textContent || '').includes('cdnmedia/transcripts')),
        { timeout: 20000 }
      );
    } catch {
      process.stderr.write('[transcript] no transcript URL appeared in page scripts within 20s\n');
    }
  }

  // Extract pre-signed transcript URL from inline scripts and fetch it
  if (!transcriptBody) {
    const transcriptResult = await page.evaluate(async () => {
      const scripts = [...document.querySelectorAll('script')];
      let transcriptUrl = null;
      for (const s of scripts) {
        const txt = s.textContent || '';
        const idx = txt.indexOf('cdnmedia/transcripts');
        if (idx >= 0) {
          const start = txt.lastIndexOf('https://', idx);
          const end = txt.indexOf('"', idx + 10);
          if (start >= 0 && end > start) {
            transcriptUrl = txt.substring(start, end)
              .replace(/\\u0026/g, '&')
              .replace(/\\\//g, '/');
            break;
          }
        }
      }
      if (!transcriptUrl) return { error: 'no transcript URL in page scripts' };
      try {
        const r = await fetch(transcriptUrl, {
          headers: { 'Accept': 'application/json', 'Accept-Encoding': 'identity' }
        });
        const text = await r.text();
        return { status: r.status, body: text, url: transcriptUrl.substring(0, 120) };
      } catch (e) {
        return { fetchError: e.message, url: transcriptUrl.substring(0, 120) };
      }
    });

    process.stderr.write('[transcript] result: ' + JSON.stringify({
      status: transcriptResult?.status,
      error: transcriptResult?.error || transcriptResult?.fetchError,
      url: transcriptResult?.url,
      bodyLen: transcriptResult?.body?.length
    }) + '\n');

    if (transcriptResult?.body && transcriptResult.body.length > 50) {
      transcriptBody = transcriptResult.body;
    }
  }

  // Output page info + transcript
  const finalUrl = page.url();
  const title = await page.title();
  const text = await page.evaluate(() => document.body?.innerText || '');

  console.log(`URL: ${finalUrl}`);
  console.log(`Title: ${title}`);
  console.log('---');
  console.log(text.slice(0, 50000));
  if (transcriptBody) {
    console.log('\nTRANSCRIPT_JSON:\n' + transcriptBody.slice(0, 50000));
  }
} finally {
  await browser.close();
}
