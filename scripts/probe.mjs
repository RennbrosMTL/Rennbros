/**
 * Evaluate an expression in a page at a given width, print the JSON result.
 *   node scripts/probe.mjs <width> <path> "<expression>"
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SITE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [w, path, expr] = process.argv.slice(2);
const width = Number(w);
const mobile = width < 700;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
await page.goto(BASE + path, { waitUntil: "networkidle2", timeout: 90000 });
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
await browser.close();
