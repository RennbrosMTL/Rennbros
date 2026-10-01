/**
 * Enlarged text, the way visitors actually do it: the browser's default font
 * size (Chrome's "Font size" setting), here doubled to 32px (WCAG 1.4.4, 200%).
 *   node scripts/textzoom.mjs <baseUrl> <path> [path...]
 * Reports horizontal overflow and the elements causing it, at desktop and
 * phone widths.
 */
import puppeteer from "puppeteer-core";

const [base, ...paths] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let bad = 0;
for (const [w, h] of [[1280, 900], [768, 1024], [390, 844]]) {
  for (const path of paths) {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h });
    const cdp = await p.createCDPSession();
    await cdp.send("Page.enable");
    await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32, fixed: 26 } });
    await p.goto(base + path, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 500));
    const r = await p.evaluate(() => {
      const iw = document.documentElement.clientWidth;
      const leaves = [...document.querySelectorAll("body *")]
        .filter((e) => e.getBoundingClientRect().right > iw + 1 && !e.closest(".voices__row, .mq__window, .smap__map, .rv__track, [aria-hidden='true']"))
        .filter((e) => ![...e.children].some((c) => c.getBoundingClientRect().right > iw + 1));
      return { sw: document.documentElement.scrollWidth, iw, rootPx: getComputedStyle(document.documentElement).fontSize, culprits: leaves.slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`) };
    });
    const over = r.sw > r.iw;
    if (over) bad++;
    console.log(`${over ? "FAIL" : "ok  "} ${w}px ${path.padEnd(18)} root ${r.rootPx}${over ? `  overflow ${r.sw}>${r.iw}  ${r.culprits.join(", ")}` : ""}`);
    await p.close();
  }
}
await browser.close();
console.log(bad ? `\n${bad} overflowing` : "\nno overflow at 200% text");
process.exit(bad ? 1 : 0);
