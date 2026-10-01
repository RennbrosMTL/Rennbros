"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

type Pic = { src: string; alt: string; width: number; height: number };

/**
 * Before and after in one frame: drag anywhere on the photograph (vertical
 * swipes still scroll the page), or use the arrow keys on the hidden range.
 * It nudges once when it first comes into view, so it reads as movable.
 * Position lives in a CSS variable; no re-render while dragging.
 */
export function BeforeAfter({ before, after, labels, sizes }: { before: Pic; after: Pic; labels: { before: string; after: string; label: string }; sizes: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const f = frame.current!;
    const r = range.current!;
    const set = (pct: number) => {
      const v = Math.max(0, Math.min(100, pct));
      f.style.setProperty("--pos", `${v}%`);
      r.value = String(Math.round(v));
    };
    const fromEvent = (e: PointerEvent) => {
      const b = f.getBoundingClientRect();
      return ((e.clientX - b.left) / b.width) * 100;
    };
    const onInput = () => set(Number(r.value));
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      f.setPointerCapture(e.pointerId);
      f.classList.add("is-dragging");
      set(fromEvent(e));
    };
    const move = (e: PointerEvent) => f.hasPointerCapture(e.pointerId) && set(fromEvent(e));
    const up = (e: PointerEvent) => {
      if (f.hasPointerCapture(e.pointerId)) f.releasePointerCapture(e.pointerId);
      f.classList.remove("is-dragging");
    };
    r.addEventListener("input", onInput);
    f.addEventListener("pointerdown", down);
    f.addEventListener("pointermove", move);
    f.addEventListener("pointerup", up);
    f.addEventListener("pointercancel", up);

    let io: IntersectionObserver | undefined;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io!.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          if (f.classList.contains("is-dragging")) return;
          const p = Math.min(1, (now - start) / 1400);
          set(50 + Math.sin(p * Math.PI * 2) * 12 * (1 - p));
          if (p < 1) requestAnimationFrame(tick);
        };
        setTimeout(() => requestAnimationFrame(tick), 350);
      }, { threshold: 0.6 });
      io.observe(f);
    }
    return () => {
      io?.disconnect();
      r.removeEventListener("input", onInput);
      f.removeEventListener("pointerdown", down);
      f.removeEventListener("pointermove", move);
      f.removeEventListener("pointerup", up);
      f.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div className="ba light-surface" ref={frame} style={{ ["--pos" as string]: "50%" }}>
      <Image className="ba__img" src={after.src} alt={after.alt} width={after.width} height={after.height} sizes={sizes} />
      <div className="ba__before">
        <Image className="ba__img" src={before.src} alt={before.alt} width={before.width} height={before.height} sizes={sizes} />
      </div>
      <span className="ba__tag ba__tag--before" aria-hidden>{labels.before}</span>
      <span className="ba__tag ba__tag--after" aria-hidden>{labels.after}</span>
      <span className="ba__line" aria-hidden>
        <span className="ba__knob"><CaretLeft size={12} weight="bold" /><CaretRight size={12} weight="bold" /></span>
      </span>
      <input ref={range} className="ba__range" type="range" min={0} max={100} defaultValue={50} step={1} aria-label={labels.label} />
    </div>
  );
}
