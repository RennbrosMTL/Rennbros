/**
 * DRIVEWAY's signature: the menu builds a visit.
 *   node scripts/visit.mjs
 * Adds services on the menu, checks the running estimate and the live next
 * window, that the visit survives a page change (product page, hero chip),
 * that "Book this visit" hands it to the booking form, and the map towns.
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SITE_URL ?? "http://localhost:3000";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let fails = 0;
const ok = (c, l, x = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? `  (${x})` : ""}`); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tap = async (p, sel) => { await p.$eval(sel, (el) => el.scrollIntoView({ block: "center" })); await wait(250); await p.click(sel); };

for (const [w, mobile] of [[1440, false], [390, true]]) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: mobile ? 844 : 900, isMobile: mobile, hasTouch: mobile });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await p.evaluate(() => localStorage.removeItem("rennbros.visit"));
  await p.reload({ waitUntil: "networkidle2" });

  // Picked by the service each card links to, so adding services to the menu never breaks this.
  await tap(p, '.dish:has(a[href$="/services/oil-change"]) .dish__add');
  await tap(p, '.dish:has(a[href$="/services/brakes"]) .dish__add');
  await wait(300);
  ok(await p.$$eval('.dish__add[aria-pressed="true"]', (b) => b.length) >= 2, `${w}: two services added on the menu`);
  if (mobile) {
    ok(await p.$eval(".visit", (v) => v.classList.contains("has-items") && getComputedStyle(v).display !== "none"), `${w}: the visit sheet appears`);
    await tap(p, ".visit__bar");
  }
  await p.waitForFunction(() => /\d/.test(document.querySelector(".visit__next dd")?.textContent ?? ""), { timeout: 15000 }).catch(() => {});
  const panel = await p.evaluate(() => ({
    total: document.querySelector(".visit__total")?.textContent,
    items: document.querySelectorAll(".visit__list li").length,
    next: document.querySelector(".visit__next dd")?.textContent,
    href: document.querySelector(".visit__book")?.getAttribute("href"),
  }));
  ok(panel.items === 2 && /250/.test(panel.total ?? ""), `${w}: estimate adds up`, panel.total);
  ok(/\d/.test(panel.next ?? ""), `${w}: next open window shown`, panel.next);
  ok(panel.href?.includes("service=oil-change,brakes"), `${w}: book link carries the visit`, panel.href);

  // The visit survives a page change and the hero chip adds to it.
  await p.goto(`${BASE}/services/battery`, { waitUntil: "networkidle2" });
  await tap(p, ".product__ctas .dish__add");
  await p.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await tap(p, ".hero__chip-add");
  await wait(300);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("rennbros.visit") ?? "[]"));
  ok(saved.join() === "oil-change,tires,brakes,battery", `${w}: visit kept across pages, in menu order`, saved.join());

  // Book it: the form arrives with the services ticked.
  await p.goto(`${BASE}/book`, { waitUntil: "networkidle2" });
  await wait(500);
  const ticked = await p.$$eval('input[name="service"]:checked', (i) => i.map((x) => x.value).join());
  ok(ticked === "oil-change,tires,brakes,battery", `${w}: booking form pre-ticked from the visit`, ticked);

  // Towns fly the map.
  await p.goto(`${BASE}/area`, { waitUntil: "networkidle2" });
  await p.$eval(".smap", (e) => e.scrollIntoView());
  await p.waitForFunction(() => document.querySelector("[data-map-status]")?.hidden, { timeout: 20000 }).catch(() => {});
  await p.waitForFunction(() => !document.querySelector("[data-town]")?.disabled, { timeout: 5000 }).catch(() => {});
  // The map must actually draw: its box fills the frame and the canvas matches.
  const size = await p.evaluate(() => {
    const f = document.querySelector(".smap__canvas"), m = document.querySelector(".smap__map"), c = document.querySelector(".maplibregl-canvas");
    return { frame: f.clientHeight, box: m.clientHeight, canvas: c?.clientHeight ?? 0 };
  });
  ok(size.box > 200 && Math.abs(size.box - size.frame) < 4 && Math.abs(size.canvas - size.box) < 4, `${w}: map fills its frame`, JSON.stringify(size));
  await tap(p, '[data-town="Hudson"]');
  await wait(1500);
  ok(!!(await p.$(".smap-pin")), `${w}: a town drops a pin on the map`);
  ok(errors.length === 0, `${w}: no page errors`, errors.join(" | "));
  await p.close();
}
await browser.close();
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails);
