import localFont from "next/font/local";

/**
 * Clash Display and General Sans (Indian Type Foundry, Fontshare; ITF Free
 * Font License). Through next/font: self-hosted, preloaded, and each with a
 * metric-matched fallback, so text painted before the font arrives doesn't
 * reflow when it swaps in (it was costing the hero seconds of paint time).
 */
export const clash = localFont({
  src: [
    { path: "./fonts/ClashDisplay-500.woff2", weight: "500" },
    { path: "./fonts/ClashDisplay-600.woff2", weight: "600" },
  ],
  variable: "--font-clash",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const general = localFont({
  src: [
    { path: "./fonts/GeneralSans-400.woff2", weight: "400" },
    { path: "./fonts/GeneralSans-500.woff2", weight: "500" },
    { path: "./fonts/GeneralSans-600.woff2", weight: "600" },
  ],
  variable: "--font-general",
  display: "swap",
  adjustFontFallback: "Arial",
});
