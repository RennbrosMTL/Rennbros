"use client";

import { useEffect } from "react";
import { ArrowUp } from "@phosphor-icons/react";

/**
 * Page-level behaviour, one small client island: the edge blurs (top one
 * once the page has moved, bottom one stepping aside at the very end), the
 * back-to-top button, and the one-time reveal of [data-reveal] blocks.
 * Observers only; no scroll listeners.
 */
export function Chrome({ label }: { label: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const obs: IntersectionObserver[] = [];
    const watch = (sel: string, fn: (e: IntersectionObserverEntry) => void) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const io = new IntersectionObserver(([e]) => fn(e));
      io.observe(el);
      obs.push(io);
    };
    watch(".edge-sentinel--top", (e) => root.classList.toggle("is-scrolled", !e.isIntersecting));
    watch(".edge-sentinel--end", (e) => root.classList.toggle("at-end", e.isIntersecting));
    // Spans the first screen, so any way of leaving it (scroll or jump) registers.
    watch(".edge-sentinel--fold", (e) => root.classList.toggle("past-fold", !e.isIntersecting));

    // Reveal each block once, as it first comes into view, then leave it be.
    // With reduced motion, everything is simply visible. Blocks rendered later
    // (client components) are picked up as they appear.
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.isIntersecting && ((en.target as HTMLElement).dataset.shown = "", io.unobserve(en.target))),
      { rootMargin: "0px 0px -8% 0px" },
    );
    const track = (el: Element) => {
      const h = el as HTMLElement;
      if (still) h.dataset.shown = "";
      else if (!("shown" in h.dataset)) io.observe(el);
    };
    document.querySelectorAll("[data-reveal]").forEach(track);
    const mo = new MutationObserver((records) =>
      records.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches("[data-reveal]")) track(n);
          n.querySelectorAll("[data-reveal]").forEach(track);
        }),
      ),
    );
    mo.observe(document.body, { childList: true, subtree: true });
    obs.push(io);
    return () => {
      obs.forEach((o) => o.disconnect());
      mo.disconnect();
    };
  }, []);

  const toTop = () => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
    document.querySelector<HTMLElement>(".skip")?.focus({ preventScroll: true });
  };

  return (
    <>
      <button className="to-top" type="button" aria-label={label} onClick={toTop}>
        <ArrowUp size={20} weight="light" aria-hidden />
      </button>
      <div className="edge edge--top" aria-hidden="true"><i /><i /><i /></div>
      <div className="edge edge--bottom" aria-hidden="true"><i /><i /><i /></div>
    </>
  );
}
