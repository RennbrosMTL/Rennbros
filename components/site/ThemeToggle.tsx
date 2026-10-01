"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

const KEY = "rennbros.theme";

/**
 * Light / dark. The choice is stored per browser; the page opens light
 * unless this visitor chose dark before (applied before paint in the layout).
 */
export function ThemeToggle({ dark, light }: { dark: string; light: string }) {
  const [isDark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);

  const toggle = () => {
    const apply = () => {
      const next = document.documentElement.dataset.theme !== "dark";
      if (next) document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
      try {
        localStorage.setItem(KEY, next ? "dark" : "light");
      } catch {}
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#131417" : "#f5f6f7");
      setDark(next);
    };
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !still) doc.startViewTransition(apply);
    else apply();
  };

  return (
    <button className="theme" type="button" onClick={toggle} aria-pressed={isDark} aria-label={isDark ? light : dark}>
      <span className="theme__icon theme__icon--moon"><Moon size={19} weight="light" aria-hidden /></span>
      <span className="theme__icon theme__icon--sun"><Sun size={19} weight="light" aria-hidden /></span>
    </button>
  );
}
