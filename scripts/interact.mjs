/**
 * Interaction checks with screenshots: town buttons focus the map, the
 * address check pins an address, the before/after slider drags.
 *   node scripts/interact.mjs <outdir>
 */
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.SITE_URL ?? "http://localhost:3000";
const out = process.argv[2] ?? "shots";
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, l, x = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? `  (${x})` : ""}`); if (!c) fails++; };

for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));

  // Towns
  await p.goto(`${BASE}/area`, { waitUntil: "networkidle2" });
  await p.waitForFunction(() => document.querySelector("[data-map-status]")?.hidden, { timeout: 20000 });
  await p.waitForFunction(() => !document.querySelector("[data-town]")?.disabled, { timeout: 5000 });
  await p.$eval('[data-town="Hudson"]', (b) => b.scrollIntoView({ block: "center" }));
  await wait(400);
  await p.click('[data-town="Hudson"]');
  await wait(2600);
  ok(await p.$eval('[data-town="Hudson"]', (b) => b.getAttribute("aria-pressed") === "true"), `${w}: Hudson pressed`);
  ok(!!(await p.$(".smap-pin")), `${w}: pin dropped on Hudson`);
  await (await p.$(".smap__canvas")).screenshot({ path: `${out}/town-${w}.png` });
  await p.$eval('[data-town="Hudson"]', (b) => b.scrollIntoView({ block: "center" }));
  await wait(400);
  await p.click('[data-town="Hudson"]');
  await wait(1500);
  ok(!(await p.$(".smap-pin")), `${w}: second press returns to the whole area`);

  // Address
  await p.$eval("[data-check] input", (i) => (i.value = "200 Beaconsfield Blvd, Beaconsfield"));
  await p.$eval("[data-check]", (f) => f.requestSubmit());
  await p.waitForFunction(() => ["in", "out", "none", "error"].includes(document.querySelector("[data-result]")?.dataset.state), { timeout: 15000 });
  const state = await p.$eval("[data-result]", (r) => r.dataset.state);
  ok(state === "in", `${w}: Beaconsfield Blvd found and in the area`, state);
  await wait(2200);
  await (await p.$(".smap")).screenshot({ path: `${out}/address-${w}.png` });

  // Before / after
  await p.goto(`${BASE}/services/brakes`, { waitUntil: "networkidle2" });
  await wait(2200);
  const frame = await p.$(".ba__frame");
  const box = await frame.boundingBox();
  if (mobile) {
    await p.touchscreen.touchStart(box.x + box.width * 0.5, box.y + box.height / 2);
    await p.touchscreen.touchMove(box.x + box.width * 0.8, box.y + box.height / 2);
    await p.touchscreen.touchEnd();
  } else {
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 8 });
    await p.mouse.up();
  }
  const pos = await p.$eval(".ba__frame", (f) => parseFloat(f.style.getPropertyValue("--pos")));
  ok(pos > 70 && pos < 90, `${w}: drag moves the divide`, `${pos}%`);
  await p.focus(".ba__range");
  for (let i = 0; i < 10; i++) await p.keyboard.press("ArrowLeft");
  const pos2 = await p.$eval(".ba__frame", (f) => parseFloat(f.style.getPropertyValue("--pos")));
  ok(pos2 < pos, `${w}: arrow keys move the divide`, `${pos2}%`);
  await frame.screenshot({ path: `${out}/ba-${w}.png` });
  ok(errors.length === 0, `${w}: no page errors`, errors.join(" | "));
  await p.close();
}
await browser.close();
process.exit(fails);
