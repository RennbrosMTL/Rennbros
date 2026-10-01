/**
 * Snapshots of the live service-area map, shown instantly while the real map
 * loads (it fades in underneath once drawn). Re-run whenever the coverage
 * area, the towns or the map's colours change.
 *
 *   node scripts/map-snapshot.mjs [baseUrl=http://localhost:3000] [areaPath=/area]
 *     ->  public/media/map/area-tall.webp  (phones, 4:5 frame)
 *         public/media/map/area-wide.webp  (37.5em and up, 5:4 frame)
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "http://localhost:3000";
const PAGE = process.argv[3] ?? "/area";
const OUT = path.resolve("public/media/map");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });

for (const [name, width, height] of [["area-tall", 390, 844], ["area-wide", 1440, 900]]) {
  const p = await browser.newPage();
  await p.setViewport({ width, height, deviceScaleFactor: 2 });
  await p.evaluateOnNewDocument(() => localStorage.setItem("rennbros.theme", "light"));
  await p.goto(BASE + PAGE, { waitUntil: "networkidle2", timeout: 120000 });
  await p.$eval(".smap", (el) => el.scrollIntoView({ block: "center" }));
  await p.waitForSelector(".smap.is-live", { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1500));
  // Only the map itself: overlays that stay on top of the snapshot anyway are left out.
  await p.addStyleTag({ content: ".smap__snap, .smap__legend, .smap__status, .maplibregl-ctrl-group, .smap-pin { display: none !important; } .smap__canvas { border: 0 !important; border-radius: 0 !important; }" });
  await new Promise((r) => setTimeout(r, 300));
  const frame = await p.$(".smap__canvas");
  const file = path.join(OUT, `${name}.webp`);
  await frame.screenshot({ path: file, type: "webp", quality: 78 });
  const box = await frame.boundingBox();
  console.log(`${name}.webp  ${Math.round(box.width * 2)}x${Math.round(box.height * 2)}  ${Math.round(fs.statSync(file).size / 1024)} KB`);
  await p.close();
}
await browser.close();
