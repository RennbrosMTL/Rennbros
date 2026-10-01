/**
 * How long the map takes on a phone: a mid-range device (CPU 4x slower) on
 * slow 4G, the way Lighthouse's mobile profile throttles.
 *
 *   node scripts/map-timing.mjs [url=http://localhost:3000/] [runs=2]
 *
 * Loads the page, waits for it to settle, then scrolls the map into view the
 * way a visitor would and reports: when something map-like is visible
 * (placeholder or map), when the interactive map is ready, and what it
 * downloaded on the way.
 */
import puppeteer from "puppeteer-core";

const URL_ = process.argv[2] ?? "http://localhost:3000/";
const RUNS = Number(process.argv[3] ?? 2);
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });

for (let run = 1; run <= RUNS; run++) {
  const ctx = await browser.createBrowserContext(); // cold cache each run
  const p = await ctx.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const reqs = [];
  p.on("requestfinished", async (r) => {
    const u = r.url();
    if (!/maplibre|openfreemap|vendor\/map|map-snap|chunks/.test(u)) return;
    const res = r.response();
    const len = Number(res?.headers()["content-length"] ?? 0) || (await res?.buffer().catch(() => Buffer.alloc(0)))?.length || 0;
    reqs.push({ t: Date.now(), u: u.replace(/^https?:\/\/[^/]+/, "").slice(0, 70), kb: Math.round(len / 1024) });
  });
  await p.goto(URL_, { waitUntil: "load", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 1500)); // a visitor reads the hero for a moment
  const t0 = Date.now();
  reqs.length = 0;
  await p.$eval(".smap", (el) => el.scrollIntoView({ block: "center" }));
  const seen = await p
    .waitForFunction(() => {
      const snap = document.querySelector(".smap__snap img");
      const r = snap?.getBoundingClientRect();
      const snapOk = snap && snap.complete && snap.naturalWidth > 0 && r.top < innerHeight && r.bottom > 0;
      return snapOk || document.querySelector(".smap__map canvas") ? performance.now() : false;
    }, { timeout: 90000, polling: 50 })
    .then(() => Date.now() - t0, () => -1);
  const ready = await p
    .waitForFunction(() => document.querySelector("[data-map-status]")?.hidden === true, { timeout: 120000, polling: 100 })
    .then(() => Date.now() - t0, () => -1);
  const kb = reqs.reduce((n, r) => n + r.kb, 0);
  console.log(`run ${run}: map picture visible ${(seen / 1000).toFixed(1)} s, interactive map ready ${(ready / 1000).toFixed(1)} s, ${reqs.length} map requests, ${kb} KB`);
  if (run === 1) reqs.sort((a, b) => b.kb - a.kb).slice(0, 8).forEach((r) => console.log(`   ${String(r.kb).padStart(5)} KB  +${((r.t - t0) / 1000).toFixed(1)}s  ${r.u}`));
  await ctx.close();
}
await browser.close();
