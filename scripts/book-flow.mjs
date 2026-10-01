/**
 * The booking form, end to end, through real Chrome.
 *
 *   node scripts/book-flow.mjs
 *
 * 1. Enhanced (JS), English and French: every step, live availability,
 *    confirm, send; must land on the confirmation page with a reference.
 * 2. Validation: Continue on an empty step must stay put and show the error.
 * 3. Plain (JS disabled): the whole form posted; must land on the
 *    confirmation page via the server's 303.
 * 4. Plain, refused: missing fields must come back to #send-error with the
 *    alert visible.
 * Each check prints PASS/FAIL; the exit code is the number of failures.
 */
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const SHOTS = process.env.SHOTS ?? "shots";
fs.mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.SITE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};

async function page({ js = true, width = 1280 } = {}) {
  const p = await browser.newPage();
  await p.setJavaScriptEnabled(js);
  await p.setViewport({ width, height: 900 });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(String(e)));
  return p;
}
// Steps slide in over 320 ms; act the way a person would, once it has.
const settle = (p) => p.waitForFunction(() => !document.getAnimations().some((a) => a.animationName?.startsWith("step") && a.playState === "running"), { timeout: 3000 });
// Tap like a person: bring the control to the middle of the screen first
// (at the very top it would sit under the sticky header).
const tap = async (p, sel) => {
  await p.$eval(sel, (el) => el.scrollIntoView({ block: "center" }));
  await p.click(sel);
};
const visible = (p, sel) => p.$eval(sel, (el) => !!(el.offsetWidth || el.offsetHeight)).catch(() => false);

/* 1 + 2 · Enhanced flow ---------------------------------------------------- */
for (const lang of ["en", "fr"]) {
  const pre = lang === "fr" ? "/fr" : "";
  const p = await page({ width: lang === "fr" ? 390 : 1280 });
  // Start as a first-time visitor: nothing remembered from an earlier run.
  await p.goto(`${BASE}/legal/privacy`, { waitUntil: "domcontentloaded" });
  await p.evaluate(() => localStorage.removeItem("rennbros.details"));
  await p.goto(`${BASE}${pre}/book?service=brakes`, { waitUntil: "networkidle2" });
  // The form is enhanced once the page is live; act after that, as a person would.
  await p.waitForSelector("[data-next]:not([hidden])", { timeout: 15000 });
  ok(await p.$eval('input[name="service"][value="brakes"]', (el) => el.checked), `${lang}: ?service= preselects brakes`);
  // A second service: the total must add up (brakes 120 + mounting 90 + travel 30 = 4 h;
  // $125/h + mounting from $100 = from $225).
  await p.click('label.choice:has(input[value="tire-install"])');
  const total = await p.$eval("[data-total]", (e) => e.textContent);
  ok(/225/.test(total) && /4 h/.test(total), `${lang}: two services add up`, total);
  // Costco-style tyres: mounting asks for the rim size, and it sets the price.
  ok(await visible(p, "[data-tire-opts]"), `${lang}: mounting shows the rim sizes`);
  await tap(p, "[data-next]");
  ok(await visible(p, '[data-err="rim"].on') && (await visible(p, '[data-step="0"]')), `${lang}: no rim size blocks Continue`);
  await p.click('label.pill:has(input[name="rim"][value="17-18"]) span');
  const t2 = await p.$eval("[data-total]", (e) => e.textContent);
  ok(/245/.test(t2), `${lang}: 17–18″ rims price the mounting at $120`, t2);
  await p.click('label.choice:has(input[value="tires"])');
  const either = await p.evaluate(() => [...document.querySelectorAll('input[name="service"]:checked')].map((i) => i.value).sort().join(","));
  ok(either === "brakes,tires" && !(await visible(p, "[data-tire-opts]")), `${lang}: wheel swap and mounting are either/or`, either);
  await p.click('label.choice:has(input[value="tire-install"])');
  await p.click('label.pill:has(input[name="rim"][value="17-18"]) span');

  await tap(p, "[data-next]");
  ok(await visible(p, '[data-step="1"]'), `${lang}: step 2 shown`);
  await tap(p, "[data-next]");
  ok(await visible(p, '[data-step="1"]') && (await visible(p, '[data-err="address"].on')), `${lang}: empty address blocks Continue and shows the error`);

  await p.type('input[name="address"]', "123 Lakeshore Rd, Beaconsfield");
  await p.type('input[name="postal"]', "H9W 5L6");
  await p.click('label.pill:has(input[name="parking"]) span');
  await tap(p, "[data-next]");
  ok(await visible(p, '[data-step="2"]'), `${lang}: step 3 shown`, await p.evaluate(() => JSON.stringify({ errs: [...document.querySelectorAll(".err.on")].map((e) => e.dataset.err), parking: document.querySelector("form").elements.namedItem("parking").value, addr: document.querySelector('[name="address"]').value, steps: [...document.querySelectorAll("[data-step]")].map((s) => s.hidden) })));
  await p.waitForSelector(".win", { timeout: 15000 });
  const days = await p.$$eval(".cal__day:not(:disabled)", (els) => els.length);
  // The month on screen can hold only a few open days near its end; what
  // matters is that it opens on the first open day and shows it.
  ok(days >= 1 && (await p.$eval(".cal__day[aria-pressed=true]", (b) => !b.disabled)), `${lang}: calendar opens on the first open day`, `${days} open in ${await p.$eval("[data-cal-month]", (e) => e.textContent)}`);
  // Month navigation and the keyboard.
  const canNext = await p.$eval("[data-cal-next]", (b) => !b.disabled);
  if (canNext) {
    const before = await p.$eval("[data-cal-month]", (e) => e.textContent);
    await p.click("[data-cal-next]");
    ok((await p.$eval("[data-cal-month]", (e) => e.textContent)) !== before, `${lang}: next month`);
    await p.click("[data-cal-prev]");
  }
  const first = await p.$eval(".cal__day[aria-pressed=true]", (b) => b.dataset.day);
  await p.focus(".cal__day[aria-pressed=true]");
  await p.keyboard.press("ArrowRight");
  const moved = await p.evaluate(() => document.activeElement?.dataset?.day);
  ok(!!moved && moved > first, `${lang}: arrow key moves to the next open day`, `${first} -> ${moved}`);
  await p.keyboard.press("Enter");
  ok(await p.$eval(".cal__day[aria-pressed=true]", (b) => b.dataset.day) === moved, `${lang}: Enter picks the day`);
  ok(await p.evaluate(() => document.activeElement?.getAttribute("aria-pressed") === "true"), `${lang}: focus stays on the picked day`);
  await p.screenshot({ path: `${SHOTS}/cal-${lang}.png`, clip: await (await p.$('[data-step="2"]')).boundingBox() });
  ok(await visible(p, "[data-preview]"), `${lang}: stand-in calendar labelled as preview`);
  await tap(p, "[data-next]");
  ok(await visible(p, '[data-err="slot"].on'), `${lang}: no window chosen blocks Continue`);
  await settle(p);
  // Centre it first: scrolled to the very top it would sit under the sticky header.
  await p.$eval(".win", (w) => w.scrollIntoView({ block: "center" }));
  await p.click(".win");
  await tap(p, "[data-next]");
  ok(await visible(p, '[data-step="3"]'), `${lang}: step 4 shown`, await p.evaluate(() => JSON.stringify({ errs: [...document.querySelectorAll('.err.on')].map((e) => e.dataset.err), startAt: document.querySelector('[name=startAt]').value, wins: document.querySelectorAll('.win').length, checked: [...document.querySelectorAll('.win')].map((w) => w.getAttribute('aria-checked')), steps: [...document.querySelectorAll('[data-step]')].map((x) => x.hidden) })));

  await p.type('input[name="name"]', "Test Person");
  await p.type('input[name="phone"]', "514 555 0100");
  await p.type('input[name="email"]', "not-an-email");
  await p.type('input[name="make"]', "Sedan");
  await p.type('input[name="model"]', "Touring");
  await tap(p, "[data-next]");
  ok(await visible(p, '[data-err="email"].on'), `${lang}: bad email caught`);
  await p.$eval('input[name="email"]', (el) => (el.value = ""));
  await p.type('input[name="email"]', "test@example.com");
  await tap(p, "[data-next]");
  ok(await visible(p, '[data-step="4"]'), `${lang}: confirm step shown`);
  const review = await p.$$eval("[data-review-v]", (els) => els.map((e) => e.textContent.trim()));
  ok(review.every(Boolean), `${lang}: review filled`, review[2]);

  await Promise.all([p.waitForNavigation({ waitUntil: "networkidle2" }), p.click("[data-submit]")]);
  const url = new URL(p.url());
  ok(url.pathname.replace(/\/$/, "") === `${pre}/book/received` && /^DEMO-/.test(url.searchParams.get("ref") ?? ""), `${lang}: lands on confirmation`, url.pathname + url.search);
  ok(await visible(p, "[data-ref]") && (await visible(p, "[data-demo]")), `${lang}: reference and preview note shown`);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("rennbros.details") ?? "null"));
  ok(saved?.name === "Test Person" && saved?.make === "Sedan" && /Beaconsfield/.test(saved?.address ?? "") && !!saved?.parking, `${lang}: details remembered on this device`, JSON.stringify(saved));
  ok(p.errors.length === 0, `${lang}: no page errors`, p.errors.join(" | "));
  await p.close();
}

/* 1b · Returning customer: the form fills itself in; "Forget" clears it ---- */
{
  const p = await page({ width: 390 });
  await p.goto(`${BASE}/book?service=brakes`, { waitUntil: "networkidle2" });
  await p.waitForSelector("[data-next]:not([hidden])", { timeout: 15000 });
  ok(await visible(p, "[data-remembered]"), "returning: welcome-back line shown");
  const got = await p.evaluate(() => {
    const f = document.querySelector("form.flow");
    const v = (n) => f.elements.namedItem(n).value;
    return { name: v("name"), phone: v("phone"), email: v("email"), address: v("address"), parking: v("parking"), make: v("make"), model: v("model") };
  });
  ok(got.name === "Test Person" && got.email === "test@example.com" && /Beaconsfield/.test(got.address) && !!got.parking && got.make === "Sedan" && got.model === "Touring", "returning: name, contact, address, parking and car filled in", JSON.stringify(got));
  ok(await p.$eval('input[name="remember"]', (el) => el.checked), "returning: remember box ticked");
  await tap(p, "[data-forget]");
  const after = await p.evaluate(() => ({
    stored: localStorage.getItem("rennbros.details"),
    name: document.querySelector('[name="name"]').value,
    address: document.querySelector('[name="address"]').value,
    text: document.querySelector("[data-remembered]").textContent,
  }));
  ok(after.stored === null && after.name === "" && after.address === "" && !/Forget/i.test(after.text), "returning: Forget clears the device and the form", JSON.stringify(after));
  ok(p.errors.length === 0, "returning: no page errors", p.errors.join(" | "));
  await p.close();
}

/* 3 · Plain form, accepted -------------------------------------------------- */
{
  const p = await page({ js: false });
  await p.goto(`${BASE}/book`, { waitUntil: "networkidle2" });
  ok(await visible(p, '[data-step="2"]') && (await visible(p, 'input[name="date"]')), "no-JS: every step and the date field visible");
  const inTen = new Date(Date.now() + 10 * 86400000);
  while ([0, 6].includes(inTen.getDay())) inTen.setDate(inTen.getDate() + 1);
  const ymd = inTen.toISOString().slice(0, 10);
  await p.click('label.choice:has(input[value="oil-change"])');
  await p.type('input[name="address"]', "45 Main Rd, Hudson");
  await p.type('input[name="postal"]', "J0P 1H0");
  await p.click('label.pill:has(input[name="parking"]) span');
  await p.$eval('input[name="date"]', (el, v) => (el.value = v), ymd);
  await p.click('label.pill:has(input[value="14"]) span');
  for (const [k, v] of Object.entries({ name: "Plain Person", phone: "5145550100", email: "plain@example.com", make: "Wagon", model: "Estate" })) await p.type(`[name="${k}"]`, v);
  await Promise.all([p.waitForNavigation({ waitUntil: "networkidle2" }), p.click("[data-submit]")]);
  const url = new URL(p.url());
  ok(url.pathname.replace(/\/$/, "") === "/book/received", "no-JS: accepted request lands on confirmation", url.pathname + url.search);
  await p.close();
}

/* 4 · Plain form, refused ---------------------------------------------------- */
{
  const r = await fetch(`${BASE}/api/book`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE },
    body: new URLSearchParams({ lang: "fr", service: "brakes", address: "" }),
    redirect: "manual",
  });
  const loc = r.headers.get("location") ?? "";
  ok(r.status === 303 && loc.includes("/fr/book") && loc.endsWith("#send-error"), "no-JS: refused post redirects to #send-error", `${r.status} ${loc}`);
  const p = await page({ js: false });
  await p.goto(new URL(loc, BASE).href, { waitUntil: "networkidle2" });
  ok(await visible(p, "#send-error"), "no-JS: error alert visible via :target");
  await p.close();

  const soon = await fetch(`${BASE}/api/book`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lang: "en", service: "brakes", address: "x", postal: "H9W 5L6", parking: "Driveway", name: "A", phone: "5145550100", email: "a@b.co", make: "a", model: "b", startAt: new Date(Date.now() + 3600000).toISOString() }),
  });
  ok(soon.status === 400 && (await soon.json()).error === "lead_time", "API: a start inside the lead time is refused");

  // Combined visits: every window is one of the four arrivals and finishes by 8 pm.
  const combo = await (await fetch(`${BASE}/api/availability?services=brakes,tire-install,oil-change&days=14`)).json();
  const hours = combo.slots.map((x) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", hourCycle: "h23" }).format(new Date(x.startAt))));
  ok(combo.slots.length > 0 && combo.slots.every((x) => x.minutes === 300), "API: three services take 5 h in total", `${combo.slots.length} windows`);
  ok(hours.every((h) => [8, 11].includes(h)), "API: 5 h visits start at 8 or 11 (done by 5 pm)", [...new Set(hours)].join(","));
  const single = await (await fetch(`${BASE}/api/availability?services=oil-change&days=14`)).json();
  const hs = new Set(single.slots.map((x) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", hourCycle: "h23" }).format(new Date(x.startAt)))));
  ok([...hs].every((h) => [8, 11, 14].includes(h)) && hs.has(14) && !hs.has(17), "API: a short visit can take the 2 pm window, never 5 pm", [...hs].sort((a, b) => a - b).join(","));

  const unknown = await fetch(`${BASE}/api/availability?service=suspension`);
  ok(unknown.status === 400, "API: unknown service refused by availability");
}

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures);
