/**
 * Full-page screenshots through system Chrome (immune to the preview pane's
 * hidden-tab throttling).
 *
 *   node scripts/shot.mjs <outdir> <w> <path> [path...]
 *
 * Scrolls each page top to bottom first so lazy images and the map load,
 * then captures the whole page. Console errors are printed per page.
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = process.env.SITE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const [out, w, ...paths] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const width = Number(w);
const mobile = width < 700;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--no-sandbox"] });

for (const path of paths) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE + path, { waitUntil: "networkidle2", timeout: 90000 });
  // Scroll-driven reveals are keyed to the real viewport; a full-page capture
  // would show everything below the fold at its "not yet revealed" state.
  await page.addStyleTag({ content: "html.js [data-reveal]{opacity:1!important;transform:none!important;animation:none!important}" });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 220)); }
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 2500));
  const name = (path.replace(/[\/?=&]+/g, "_").replace(/^_|_$/g, "") || "home") + `-${width}.png`;
  await page.screenshot({ path: `${out}/${name}`, fullPage: true });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`${path} ${width}: ${h}px tall${overflow ? " HORIZONTAL OVERFLOW" : ""}${errors.length ? "\n  errors: " + errors.join("\n  ") : ""}`);
  await page.close();
}
await browser.close();
