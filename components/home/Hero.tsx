"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, Plus, SealCheck, ShieldCheck, Clock } from "@phosphor-icons/react";
import { dict, href, price, duration, serviceIn, type Lang } from "@/lib/i18n";
import { useVisit } from "@/lib/visit";
import { heroMedia } from "@/lib/season";

/** Québec: winter tires from December 1 to March 15. March to May talks about
 *  taking them off; the rest of the year about putting them on. */
const seasonOf = (m: number) => (m >= 2 && m <= 4 ? "spring" : "winter");

/**
 * The seasonal campaign over the hero loop. The loop is a static shot with
 * falling snow whose first and last frames are the same still, so it repeats
 * without a seam.
 *
 * Loading order matters: the poster is a responsive image (AVIF/WebP) and is
 * the first paint; the video is only fetched once the page has finished
 * loading, and fades in over the poster when it actually plays. It is never
 * fetched with reduced motion, Data Saver, or a 2G-class connection.
 */
export function Hero({ lang, initialSeason }: { lang: Lang; initialSeason: "winter" | "spring" }) {
  const t = dict(lang);
  const h = t.home.hero;
  const [season, setSeason] = useState(initialSeason);
  const { slugs, toggle } = useVisit();
  const video = useRef<HTMLVideoElement>(null);
  const tires = serviceIn(lang, "tires")!;
  const on = slugs.includes("tires");
  const s = h[season];

  useEffect(() => {
    setSeason(seasonOf(new Date().getMonth()));
    const v = video.current;
    if (!v) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const frugal = !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "");
    let cancelled = false;
    const start = () => {
      if (cancelled || still.matches || frugal) return;
      if (!v.src) v.src = heroMedia.loop;
      v.play().catch(() => {});
    };
    const onPlaying = () => v.classList.add("is-playing");
    const onMotion = () => (still.matches ? v.pause() : start());
    v.addEventListener("playing", onPlaying);
    still.addEventListener("change", onMotion);
    // After load, and after the browser has a moment to itself.
    const later = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 600));
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    return () => {
      cancelled = true;
      v.removeEventListener("playing", onPlaying);
      still.removeEventListener("change", onMotion);
      window.removeEventListener("load", later);
    };
  }, []);

  return (
    <section className="hero page" aria-labelledby="hero-title">
      <div className="hero__copy">
        <p className="label label--red hero__eyebrow">{s.eyebrow}</p>
        <h1 className="d1 hero__title" id="hero-title">
          <span>{s.title[0]}</span> <span className="soft">{s.title[1]}</span>
        </h1>
        <div className="hero__side">
          <p className="lead">{s.lead}</p>
          <div className="hero__ctas">
            <a className="btn btn--red" href={`${href(lang, "/book")}?service=tires`}>
              {s.primary}
              <ArrowRight size={16} weight="bold" className="arrow" aria-hidden />
            </a>
            <a className="btn btn--ghost" href="#menu">{h.secondary}</a>
          </div>
        </div>
      </div>

      <div className="hero__media">
        <Image
          className="hero__poster"
          src={heroMedia.poster}
          alt={t.images[heroMedia.alt]}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1360px) 1264px, 94vw"
        />
        <video ref={video} className="hero__video" muted loop playsInline preload="none" aria-hidden="true" />
        <div className="hero__chip light-surface">
          <div className="hero__chip-text">
            <span className="hero__chip-name">{h.chip}</span>
            <span className="hero__chip-meta num">{price(lang, tires)} · {duration(lang, tires.minutes)}</span>
          </div>
          <button type="button" className="dish__add hero__chip-add" aria-pressed={on} onClick={() => toggle("tires")}>
            <span className="dish__add-icon" aria-hidden>{on ? <Check size={16} weight="bold" /> : <Plus size={16} weight="bold" />}</span>
            <span>{on ? t.home.menu.added : t.home.menu.add}</span>
          </button>
        </div>
      </div>

      <ul className="hero__trust">
        {t.home.trust.map((line, i) => {
          const Icon = [ShieldCheck, SealCheck, Clock][i];
          return (
            <li key={line}>
              <Icon size={20} weight="light" aria-hidden />
              {line}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
