/**
 * The device matrix: every page at real phone, tablet and desktop sizes, as
 * those devices report themselves (touch, pixel ratio, mobile user agent).
 * Prints overflow and header-fit problems; saves a first-screen capture of
 * each so the typography and spacing can be judged by eye.
 *
 *   node scripts/devices.mjs <outdir> [path ...]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = process.env.SITE_URL ?? "http://localhost:3000";
const out = process.argv[2] ?? "shots";
fs.mkdirSync(out, { recursive: true });
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ["/", "/book/", "/services/brakes/", "/fr/"];
fs.mkdirSync(out, { recursive: true });

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const devices = [
  ["android-360", 360, 800, 3, true, ANDROID],
  ["iphone-390", 390, 844, 3, true, IPHONE],
  ["iphone-430", 430, 932, 3, true, IPHONE],
  ["ipad-768", 768, 1024, 2, true, IPAD],
  ["ipad-820", 820, 1180, 2, true, IPAD],
  ["ipad-1024", 1024, 768, 2, true, IPAD],
  ["ipad-1180", 1180, 820, 2, true, IPAD],
  ["desktop-1440", 1440, 900, 1, false, null],
  ["desktop-1920", 1920, 1080, 1, false, null],
];

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--hide-scrollbars"] });
let problems = 0;
for (const [name, width, height, dpr, touch, ua] of devices) {
  for (const path of paths) {
    const page = await browser.newPage();
    if (ua) await page.setUserAgent(ua);
    await page.setViewport({ width, height, deviceScaleFactor: dpr > 2 ? 2 : dpr, isMobile: touch && width < 1100, hasTouch: touch });
    await page.goto(BASE + path, { waitUntil: "networkidle2" });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const iw = innerWidth;
      const over = [...document.querySelectorAll("body *")]
        .filter((e) => !e.closest(".voices__row, .rv__viewport, .mq__window, .bar, .menu, .smap__map, .edge") && e.getBoundingClientRect().right > iw + 1)
        .slice(0, 3).map((e) => `${e.tagName}.${String(e.className).split(" ")[0]}`);
      // Header: nothing may overlap, and the row may not wrap.
      const head = document.querySelector(".head__in");
      const kids = [...head.children].filter((e) => e.offsetWidth);
      const boxes = kids.map((e) => e.getBoundingClientRect());
      const overlap = boxes.some((b, i) => i && b.left < boxes[i - 1].right - 1);
      const tall = head.scrollHeight > head.clientHeight + 1;
      const h1 = document.querySelector("h1");
      const h1s = h1 ? getComputedStyle(h1).fontSize : "";
      const body = getComputedStyle(document.body).fontSize;
      return { sw: document.documentElement.scrollWidth, iw, over, overlap, tall, h1s, body };
    });
    const bad = r.sw > r.iw || r.over.length || r.overlap || r.tall;
    if (bad) problems++;
    console.log(`${bad ? "FAIL" : "ok  "} ${name.padEnd(13)} ${path.padEnd(18)} h1 ${r.h1s.padEnd(8)} body ${r.body}${r.sw > r.iw ? ` OVERFLOW ${r.sw}>${r.iw}` : ""}${r.over.length ? " " + r.over.join(",") : ""}${r.overlap ? " HEADER-OVERLAP" : ""}${r.tall ? " HEADER-WRAP" : ""}`);
    if (path === paths[0] || path === "/book/") await page.screenshot({ path: `${out}/${name}${path.replace(/\//g, "_")}.png` });
    await page.close();
  }
}
await browser.close();
console.log(problems ? `\n${problems} problem(s)` : "\nall devices fit");
process.exit(problems ? 1 : 0);
