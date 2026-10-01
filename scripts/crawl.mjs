/**
 * Every page in the sitemap, through real Chrome: console errors, failed
 * requests (4xx/5xx, network), broken internal links, missing titles or
 * descriptions, images without alt, and duplicate ids.
 *
 *   SITE_URL=https://rennbros-driveway-fall.netlify.app node scripts/crawl.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

// The sitemap lists the production domain; read the paths and visit them here.
const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const paths = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname))];
paths.push("/this-page-does-not-exist");
console.log(`${paths.length} pages`);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const problems = [];
const links = new Set();
for (const path of paths) {
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(`console: ${m.text().slice(0, 160)}`));
  p.on("pageerror", (e) => errs.push(`pageerror: ${String(e).slice(0, 160)}`));
  p.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/this-page-does-not-exist")) errs.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
  p.on("requestfailed", (r) => { const f = r.failure()?.errorText ?? ""; if (!/ERR_ABORTED/.test(f)) errs.push(`failed ${r.url().replace(BASE, "").slice(0, 100)} ${f}`); });
  const res = await p.goto(BASE + path, { waitUntil: "networkidle2", timeout: 90000 }).catch((e) => (errs.push(`goto: ${e.message}`), null));
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 1500));
  const info = await p.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content ?? "",
    h1: document.querySelectorAll("h1").length,
    noAlt: [...document.querySelectorAll("img:not([alt])")].map((i) => i.src.slice(-50)),
    dupIds: Object.entries([...document.querySelectorAll("[id]")].reduce((a, e) => ((a[e.id] = (a[e.id] ?? 0) + 1), a), {})).filter(([, n]) => n > 1).map(([k]) => k),
    hrefs: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
    lang: document.documentElement.lang,
  }));
  info.hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//")).forEach((h) => links.add(h.split("#")[0]));
  const expect404 = path === "/this-page-does-not-exist";
  if (expect404 ? res?.status() !== 404 : res?.status() !== 200) errs.push(`status ${res?.status()}`);
  if (!expect404) {
    if (!info.title) errs.push("no <title>");
    if (!info.desc && !path.includes("/book/received")) errs.push("no meta description");
    if (info.h1 !== 1) errs.push(`${info.h1} <h1>`);
  }
  if (info.noAlt.length) errs.push(`img without alt: ${info.noAlt.join(", ")}`);
  if (info.dupIds.length) errs.push(`duplicate ids: ${info.dupIds.join(", ")}`);
  console.log(`${errs.length ? "ISSUE" : "ok   "} ${path}  [${info.lang}] ${info.title}`);
  errs.forEach((e) => { console.log(`       ${e}`); problems.push(`${path}: ${e}`); });
  await p.close();
}
// Internal links found on the pages that weren't in the sitemap.
const extra = [...links].filter((l) => !paths.includes(l) && !paths.includes(l.replace(/\/$/, "")) && !l.startsWith("/api/") && !l.includes("?"));
for (const l of extra) {
  const r = await fetch(BASE + l, { redirect: "follow" });
  if (r.status >= 400) { console.log(`BROKEN LINK ${l} -> ${r.status}`); problems.push(`link ${l}: ${r.status}`); }
}
console.log(`\n${extra.length} extra internal links checked; ${problems.length} problem(s)`);
await browser.close();
