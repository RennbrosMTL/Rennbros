/**
 * Accessibility + responsive audit of a live site.
 *   node scripts/a11y-audit.mjs <baseUrl> <path> [path...]
 * For each page: axe-core (WCAG 2.2 A/AA) in light and dark theme, a tap
 * target census on a phone (WCAG 2.5.8 minimum 24px; 44px recommended),
 * and 200% text zoom (WCAG 1.4.4) for horizontal overflow. JSON to stdout.
 */
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axeSrc = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const [base, ...paths] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const out = [];

for (const path of paths) {
  for (const theme of ["light", "dark"]) {
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 900 });
    // Set (or clear) the theme on every page: storage persists across pages in one browser.
    await p.evaluateOnNewDocument((t) => (t === "dark" ? localStorage.setItem("rennbros.theme", "dark") : localStorage.removeItem("rennbros.theme")), theme);
    await p.goto(base + path, { waitUntil: "networkidle2" });
    await p.addStyleTag({ content: "html.js [data-reveal]{opacity:1!important;transform:none!important;animation:none!important}" });
    await new Promise((r) => setTimeout(r, 800));
    await p.evaluate(axeSrc);
    const res = await p.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")), detail: v.nodes[0]?.any?.[0]?.message ?? v.nodes[0]?.failureSummary?.slice(0, 160) }));
    });
    out.push({ path, theme, axe: res });
    await p.close();
  }

  // Tap targets on a phone.
  const m = await browser.newPage();
  await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await m.evaluateOnNewDocument(() => localStorage.removeItem("rennbros.theme"));
  await m.goto(base + path, { waitUntil: "networkidle2" });
  const taps = await m.evaluate(() => {
    const els = [...document.querySelectorAll("a, button, input, select, textarea, summary, [role=button]")].filter((e) => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !e.closest("[hidden], .sr-only, .skip") && s.opacity !== "0";
    });
    const small = (lim) => els.filter((e) => {
      const r = e.getBoundingClientRect();
      // Inline links inside running text are exempt (WCAG 2.5.8 inline exception).
      if (e.tagName === "A" && getComputedStyle(e).display === "inline" && e.closest("p, li")) return false;
      return Math.min(r.width, r.height) < lim;
    });
    const label = (e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} "${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 24)}"`;
    return { total: els.length, under24: small(24).map(label), under44: small(44).map(label).slice(0, 12), under44n: small(44).length };
  });
  // 200% text zoom, as the browser's own font-size setting does it (so em
  // media queries respond, as they would for a real visitor).
  await m.setViewport({ width: 1280, height: 900 });
  const cdp = await m.createCDPSession();
  await cdp.send("Page.enable");
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32, fixed: 26 } });
  await m.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 400));
  const zoom = await m.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: innerWidth,
    culprits: [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".voices__row, .rv__viewport, .mq__window, .smap__map")).filter((e) => ![...e.children].some((c) => c.getBoundingClientRect().right > innerWidth + 1)).slice(0, 5).map((e) => `${e.tagName}.${String(e.className).split(" ")[0]} r=${Math.round(e.getBoundingClientRect().right)}`),
  }));
  out.push({ path, taps, zoom200: zoom });
  await m.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
