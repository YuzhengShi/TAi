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

    // Password step — use Microsoft's actual field ID, wait for it to be interactive
    await page.waitForSelector('#i0118, input[name="passwd"]', { timeout: 15000, visible: true });
    await new Promise(r => setTimeout(r, 1000));
    await page.type('#i0118, input[name="passwd"]', password, { delay: 80 });
    await page.click('#idSIButton9');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

    // Duo MFA handling — detect Duo v4 prompt page
    await new Promise(r => setTimeout(r, 3000));
    const isDuo = page.url().includes('duosecurity.com') ||
      await page.$('iframe[src*="duosecurity.com"]').then(f => !!f).catch(() => false);

    if (isDuo) {
      console.error('[auth] Duo MFA detected, looking for phone call option...');

      // Duo v4 may be in an iframe or the main page
      const duoFrame = page.frames().find(f => f.url().includes('duosecurity.com'));
      const ctx = duoFrame || page;

      // Step 1: Click "Other options" to expand alternatives
      const otherOpts = await ctx.waitForSelector(
        'a::-p-text("Other options"), button::-p-text("Other options"), [data-testid="other-options-link"]',
        { timeout: 8000, visible: true }
      ).catch(() => null);

      if (otherOpts) {
        await otherOpts.click();
        console.error('[auth] Clicked "Other options"');
        await new Promise(r => setTimeout(r, 2000));
      }

      // Step 2: Find and click the phone call option (number ending in 1394)
      const callOption = await ctx.evaluateHandle(() => {
        const els = [...document.querySelectorAll('button, a, div[role="button"], [data-testid]')];
        return els.find(el => {
          const text = el.textContent || '';
          return (text.includes('1394') || text.toLowerCase().includes('call')) &&
                 (text.toLowerCase().includes('phone') || text.toLowerCase().includes('call'));
        }) || null;
      });

      if (callOption && callOption.asElement()) {
        await callOption.asElement().click();
        console.error('[auth] Clicked phone call option (1394), waiting up to 60s...');
      } else {
        // Fallback: click any "Call" button visible
        const fallbackCall = await ctx.$('button::-p-text("Call")').catch(() => null);
        if (fallbackCall) {
          await fallbackCall.click();
          console.error('[auth] Clicked fallback "Call" button, waiting up to 60s...');
        } else {
          console.error('[auth] No call option found, waiting 60s for manual approval...');
        }
      }

      // Wait up to 60s for Duo to complete and redirect away
      await page.waitForFunction(
        () => !window.location.href.includes('duosecurity.com') &&
              !window.location.href.includes('login.microsoftonline.com') &&
              !window.location.href.includes('login.live.com'),
        { timeout: 60000 }
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
