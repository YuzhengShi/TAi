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

  let transcriptBody = '';

  // Load saved cookies before navigating
  const savedCookies = await loadSession();
  if (savedCookies) {
    await page.setCookie(...savedCookies);
  }

  // Use CDP to capture the bearer token the Stream app uses for media requests
  const client = await page.createCDPSession();
  await client.send('Network.enable');
  let bearerToken = null;
  client.on('Network.requestWillBeSent', (p) => {
    if (p.request.url.includes('cdnmedia') && !bearerToken) {
      bearerToken = p.request.headers['x-authorization'] || p.request.headers['Authorization'];
    }
  });

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

  // Wait for Stream app to fire its media requests (bearer token captured by CDP listener above)
  await new Promise(r => setTimeout(r, 15000));

  if (bearerToken && !transcriptBody) {
    try {
      // Extract drive/item IDs from the page HTML
      const pageHtml = await page.content();
      const driveMatch = pageHtml.match(/drives\/(b![a-zA-Z0-9_-]{40,})/);
      const itemMatch = pageHtml.match(/items\/([A-Z0-9]{30,})/);
      if (driveMatch && itemMatch) {
        const driveId = driveMatch[1];
        const itemId = itemMatch[1];
        const baseUrl = page.url().split('/_layouts')[0];
        const siteBase = new URL(baseUrl).origin + '/personal/m_coady_northeastern_edu';
        const hdrs = {
          'Authorization': bearerToken,
          'Accept': 'application/json',
          'Accept-Encoding': 'identity',
        };

        // Get transcript list
        const listResp = await fetch(`${siteBase}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts`, { headers: hdrs });
        if (listResp.ok) {
          const listJson = await listResp.json();
          const transcripts = listJson.value || [];
          process.stderr.write(`[transcript] found ${transcripts.length} transcript(s)\n`);
          // Get first/default transcript content
          const defaultTranscript = transcripts.find(t => t.isDefault) || transcripts[0];
          if (defaultTranscript) {
            const contentResp = await fetch(
              `${siteBase}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts/${defaultTranscript.id}/content`,
              { headers: { ...hdrs, 'Accept': 'text/vtt, */*' } }
            );
            if (contentResp.ok) {
              transcriptBody = await contentResp.text();
              process.stderr.write(`[transcript] fetched VTT len=${transcriptBody.length}\n`);
            } else {
              process.stderr.write(`[transcript] content fetch failed: ${contentResp.status}\n`);
            }
          }
        } else {
          process.stderr.write(`[transcript] list failed: ${listResp.status}\n`);
        }
      } else {
        process.stderr.write('[transcript] could not extract drive/item IDs from page\n');
      }
    } catch(e) {
      process.stderr.write(`[transcript] error: ${e.message}\n`);
    }
  } else if (!bearerToken) {
    process.stderr.write('[transcript] no bearer token captured\n');
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
    console.log('\nTRANSCRIPT_VTT:\n' + transcriptBody.slice(0, 100000));
  }
} finally {
  await browser.close();
}
