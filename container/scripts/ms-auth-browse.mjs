#!/usr/bin/env node
/**
 * Microsoft-authenticated SharePoint browser.
 * Usage: node /opt/scripts/ms-auth-browse.mjs <url>
 *
 * Reads MS_EMAIL and MS_PASSWORD from environment.
 * Persists session cookies to S3 so Duo MFA only needed once.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import puppeteer from 'puppeteer-core';

const S3_BUCKET = 'tai-backups-prod';
const S3_KEY = 'ms-session.json';
const LOCAL_SESSION = '/tmp/ms-session.json';

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
function loadSession() {
  try {
    execSync(`aws s3 cp s3://${S3_BUCKET}/${S3_KEY} ${LOCAL_SESSION} --quiet 2>/dev/null`, { stdio: 'pipe' });
    const cookies = JSON.parse(fs.readFileSync(LOCAL_SESSION, 'utf-8'));
    console.error('[auth] Session loaded from S3');
    return cookies;
  } catch {
    console.error('[auth] No session found, fresh login required');
    return null;
  }
}

// Save session to S3 after successful auth
function saveSession(cookies) {
  try {
    fs.writeFileSync(LOCAL_SESSION, JSON.stringify(cookies));
    execSync(`aws s3 cp ${LOCAL_SESSION} s3://${S3_BUCKET}/${S3_KEY} --quiet`, { stdio: 'pipe' });
    console.error('[auth] Session saved to S3');
  } catch (e) {
    console.error(`[auth] Failed to save session: ${e.message}`);
  }
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Load saved cookies before navigating
  const savedCookies = loadSession();
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
      const codeMatch = pageText.match(/(\d{2,3}\s?\d{2,3})/);
      if (codeMatch) {
        console.error(`[auth] Duo verification code: ${codeMatch[0]}`);
      } else {
        console.error('[auth] Duo MFA detected — waiting for push approval...');
      }
      console.error('[auth] Waiting up to 120s for approval...');
      await page.waitForFunction(
        () => !window.location.href.includes('duosecurity.com') &&
              !window.location.href.includes('login.microsoftonline.com') &&
              !window.location.href.includes('login.live.com'),
        { timeout: 120000 }
      ).catch(() => {
        console.error('[auth] Duo timeout — approval may not have completed');
      });
    }

    // "Stay signed in?" prompt
    const staySignedIn = await page.$('#idSIButton9, input[value="Yes"]');
    if (staySignedIn) {
      await staySignedIn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    }

    // Wait for final redirect to SharePoint
    await page.waitForFunction(
      () => !window.location.href.includes('login.microsoftonline.com') && !window.location.href.includes('login.live.com'),
      { timeout: 15000 }
    ).catch(() => {});
  }

  // Save session after successful auth (or refresh existing)
  if (didAuth || savedCookies) {
    const cookies = await page.cookies();
    if (cookies.length > 0 && !page.url().includes('login.microsoftonline.com')) {
      saveSession(cookies);
    }
  }

  // Wait for dynamic content
  await new Promise(r => setTimeout(r, 3000));

  // Output page info
  const finalUrl = page.url();
  const title = await page.title();
  const text = await page.evaluate(() => document.body?.innerText || '');

  console.log(`URL: ${finalUrl}`);
  console.log(`Title: ${title}`);
  console.log('---');
  console.log(text.slice(0, 50000));
} finally {
  await browser.close();
}
