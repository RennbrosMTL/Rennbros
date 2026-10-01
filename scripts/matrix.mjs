/**
 * Real device sizes in real browsers (Chrome, Edge): every key page checked
 * for sideways scrolling, the header fitting, the hero chip on one row, and
 * text too small to read (the logo's small-caps line and the Worn/New tags are
 * deliberate and skipped); plus a first-screen capture per device and browser.
 *
 *   SITE_URL=... SHOTS=<dir> node scripts/matrix.mjs
 */
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SHOTS = process.env.SHOTS ?? "shots";
const BROWSERS = {
  Chrome: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  Edge: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
};
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const AND = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";
const DEVICES = [
  ["iPhone SE", 375, 667, 2, IOS],
  ["iPhone 15", 393, 852, 3, IOS],
  ["iPhone 15 Pro Max", 430, 932, 3, IOS],
  ["Galaxy (small)", 360, 780, 3, AND],
  ["Pixel 9", 412, 915, 2.6, AND],
  ["iPad portrait", 820, 1180, 2, IPAD],
  ["iPad landscape", 1180, 820, 2, IPAD],
  ["Laptop", 1366, 768, 1, null],
  ["Desktop", 1920, 1080, 1, null],
];
const PAGES = ["/", "/services", "/services/tire-install", "/book", "/area", "/faq", "/fr"];
fs.mkdirSync(SHOTS, { recursive: true });

let problems = 0;
for (const [bname, exe] of Object.entries(BROWSERS)) {
  // A throwaway profile, so an open window of the same browser doesn't block it.
  const userDataDir = fs.mkdtempSync(`${process.env.TEMP ?? "."}/matrix-${bname}-`);
  let browser;
  try {
    if (!fs.existsSync(exe)) throw new Error("not installed");
    browser = await puppeteer.launch({ executablePath: exe, headless: true, userDataDir, args: ["--hide-scrollbars", "--no-first-run"] });
  } catch (e) {
    console.log(`skip  ${bname}: couldn't start (${e.message.split("\n")[0]})`);
    continue;
  }
  for (const [name, w, h, dpr, ua] of DEVICES) {
    const p = await browser.newPage();
    const mobile = !!ua && w < 1000;
    if (ua) await p.setUserAgent(ua);
    await p.setViewport({ width: w, height: h, deviceScaleFactor: Math.min(dpr, 2), isMobile: mobile, hasTouch: !!ua });
    const issues = [];
    for (const path of PAGES) {
      await p.goto(BASE + path, { waitUntil: "networkidle2", timeout: 120000 });
      await new Promise((r) => setTimeout(r, 400));
      const m = await p.evaluate(() => {
        const doc = document.documentElement;
        const head = document.querySelector("header")?.getBoundingClientRect();
        const chip = document.querySelector(".hero__chip");
        let chipRow = null;
        if (chip) {
          const t = chip.querySelector(".hero__chip-text").getBoundingClientRect();
          const a = chip.querySelector(".hero__chip-add").getBoundingClientRect();
          chipRow = Math.abs(t.top + t.height / 2 - (a.top + a.height / 2)) < 4;
        }
        const tiny = [...document.querySelectorAll("p, li, a, button, span, label")]
          .filter((e) => e.offsetParent && e.textContent.trim() && !e.closest(".maplibregl-ctrl-attrib, .sr-only, .mark__imprint, .ba__tag") && parseFloat(getComputedStyle(e).fontSize) < 11.5).length;
        return { sw: doc.scrollWidth, iw: innerWidth, headOk: !head || head.right <= innerWidth + 1, chipRow, tiny };
      });
      if (m.sw > m.iw + 1) issues.push(`${path}: scrolls sideways (${m.sw}>${m.iw})`);
      if (!m.headOk) issues.push(`${path}: header wider than screen`);
      if (m.chipRow === false && w >= 344) issues.push(`${path}: hero chip wraps`);
      if (m.tiny) issues.push(`${path}: ${m.tiny} bits of text under 11.5px`);
      if (path === "/") await p.screenshot({ path: `${SHOTS}/${bname}-${name.replace(/\W+/g, "-")}.png` });
    }
    problems += issues.length;
    console.log(`${issues.length ? "ISSUE" : "ok   "} ${bname.padEnd(6)} ${name.padEnd(18)} ${w}x${h}${issues.length ? "\n        " + issues.join("\n        ") : ""}`);
    await p.close();
  }
  await browser.close();
}
console.log(`\n${problems} problem(s)`);
