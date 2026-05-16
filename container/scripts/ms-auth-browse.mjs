#!/usr/bin/env node
/**
 * Microsoft-authenticated SharePoint browser.
 * Usage: node /opt/scripts/ms-auth-browse.mjs <url>
 *
 * Reads MS_EMAIL and MS_PASSWORD from environment.
 * Opens the URL, handles Microsoft login if redirected, then outputs page text.
 */
import { execSync } from 'child_process';
import puppeteer from 'puppeteer-core';

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

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Check if redirected to Microsoft login
  if (page.url().includes('login.microsoftonline.com') || page.url().includes('login.live.com')) {
    // Email step
    await page.waitForSelector('input[type="email"], input[name="loginfmt"]', { timeout: 10000 });
    await page.type('input[type="email"], input[name="loginfmt"]', email, { delay: 50 });
    await page.click('input[type="submit"], #idSIButton9');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

    // Password step
    await page.waitForSelector('input[type="password"], input[name="passwd"]', { timeout: 10000 });
    await page.type('input[type="password"], input[name="passwd"]', password, { delay: 50 });
    await page.click('input[type="submit"], #idSIButton9');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

    // "Stay signed in?" prompt
    const staySignedIn = await page.$('#idSIButton9, input[value="Yes"]');
    if (staySignedIn) {
      await staySignedIn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    }

    // Wait for final redirect to SharePoint
    await page.waitForFunction(
      () => !window.location.href.includes('login.microsoftonline.com') && !window.location.href.includes('login.live.com'),
      { timeout: 20000 }
    ).catch(() => {});
  }

  // Wait a bit for dynamic content
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
