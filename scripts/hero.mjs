/**
 * First-screen capture of the hero once its video is playing, to check which
 * season a build shows.
 *
 *   node scripts/hero.mjs <url> <out.png> [width=1440]
 */
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [url, out, w = "1440"] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.setViewport({ width: +w, height: Math.round(+w * 0.5625) });
await page.goto(url, { waitUntil: "load" });
const playing = await page
  .waitForFunction(() => document.querySelector(".hero__video.is-playing")?.currentTime > 1.5, { timeout: 20000 })
  .then(() => true, () => false);
const src = await page.$eval(".hero__video", (v) => v.currentSrc || v.src || "(none)");
console.log(playing ? "video playing" : "video NOT playing (poster only)", src);
await page.screenshot({ path: out });
await browser.close();
