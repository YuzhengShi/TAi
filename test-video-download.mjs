import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import puppeteer from "puppeteer-core";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-west-2" });
let cookies = null;
try {
  const resp = await s3.send(new GetObjectCommand({ Bucket: "tai-backups-prod", Key: "ms-session.json" }));
  cookies = JSON.parse(await resp.Body.transformToString());
  console.log("Session loaded");
} catch(e) { console.log("No session"); }

const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;
const url = "https://northeastern.instructure.com/api/v1/courses/" + courseId + "/modules?include[]=items&per_page=50";
const resp = await fetch(url, { headers: { Authorization: "Bearer " + token } });
const modules = await resp.json();
let videoUrl = null;
for (const m of modules) {
  if (!m.name.includes("Week 4")) continue;
  for (const item of (m.items||[])) {
    if (item.type === "ExternalUrl" && item.external_url && item.external_url.includes("sharepoint")) {
      videoUrl = item.external_url;
    }
  }
}
console.log("Video URL:", videoUrl);
if (!videoUrl) process.exit(0);

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium", headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
});
const page = await browser.newPage();
await page.setExtraHTTPHeaders({ "Accept-Encoding": "identity" });
if (cookies) await page.setCookie(...cookies);

let bearerToken = null;
const client = await page.createCDPSession();
await client.send("Network.enable");
client.on("Network.requestWillBeSent", (p) => {
  if (p.request.url.includes("cdnmedia") && !bearerToken) {
    bearerToken = p.request.headers["x-authorization"] || p.request.headers["Authorization"];
  }
});

await page.goto(videoUrl, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise(r => setTimeout(r, 15000));

console.log("Bearer:", bearerToken ? "captured" : "NONE");
const html = await page.content();
const driveMatch = html.match(/drives\/(b![a-zA-Z0-9_-]{40,})/);
const itemMatch = html.match(/items\/([A-Z0-9]{30,})/);
console.log("Drive:", driveMatch ? driveMatch[1].slice(0,20)+"..." : "NONE");
console.log("Item:", itemMatch ? itemMatch[1].slice(0,20)+"..." : "NONE");

if (bearerToken && driveMatch && itemMatch) {
  const siteBase = new URL(page.url()).origin + "/personal/m_coady_northeastern_edu";
  const contentUrl = siteBase + "/_api/v2.1/drives/" + driveMatch[1] + "/items/" + itemMatch[1] + "/content";
  console.log("Fetching content endpoint...");
  const dlResp = await fetch(contentUrl, {
    headers: { Authorization: bearerToken },
    redirect: "follow"
  });
  console.log("Status:", dlResp.status);
  console.log("Content-Type:", dlResp.headers.get("content-type"));
  console.log("Content-Length:", dlResp.headers.get("content-length"));
  console.log("Redirected to:", dlResp.url.slice(0, 150));
  // Try to read just the first few bytes to confirm it's video data
  if (dlResp.ok) {
    const reader = dlResp.body.getReader();
    const { value } = await reader.read();
    console.log("First bytes:", value ? value.slice(0, 16).toString() : "empty");
    console.log("Chunk size:", value ? value.length : 0);
    reader.cancel();
  }
} else {
  console.log("Missing bearer or IDs — cannot test download");
}
await browser.close();
