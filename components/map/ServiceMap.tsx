"use client";

import { useEffect, useRef } from "react";
import { Check, WarningCircle } from "@phosphor-icons/react";
import { business } from "@/lib/business";
import { coverage, townPoints, center } from "@/lib/area";
import { dict, href, plain, town, type Lang } from "@/lib/i18n";

/**
 * The service area on a real, light basemap (MapLibre + OpenFreeMap's
 * positron, or Google Maps when NEXT_PUBLIC_GOOGLE_MAPS_KEY is set), loaded
 * when it nears the screen. Town buttons anywhere on the page ([data-town])
 * drop a pin and fly there; the address check does the same for an address.
 */
export function ServiceMap({ lang, check = true }: { lang: Lang; check?: boolean }) {
  const t = dict(lang);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const cfg = {
      lang,
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "",
      center,
      coverage,
      towns: business.area.towns.map((key) => ({ key, name: plain(town(lang, key)), at: townPoints[key] })),
      gestures: t.map.gestures,
      text: { searching: t.check.searching, in: t.check.in, out: t.check.out, none: t.check.none, error: t.check.error, failed: t.map.failed },
      bookHref: href(lang, "/book"),
    };
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const { mountMap } = await import("@/lib/map/mount");
        mountMap(el, cfg);
      },
      { rootMargin: "1600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lang, t]);

  return (
    <div className="smap" ref={root}>
      <div className="smap__canvas light-surface" role="region" aria-label={t.map.aria}>
        <div className="smap__map" data-map />
        <p className="smap__status" data-map-status>{t.map.loading}</p>
        {/* A snapshot of this exact map, shown at once; the live map fades in under it (scripts/map-snapshot.mjs). */}
        <picture className="smap__snap" aria-hidden>
          <source media="(min-width: 37.5em)" srcSet="/media/map/area-wide.webp" />
          <img src="/media/map/area-tall.webp" alt="" width={780} height={975} decoding="async" />
        </picture>
        <p className="smap__legend"><span className="smap__swatch" aria-hidden />{t.map.legend}</p>
      </div>
      {check && (
        <form className="smap__check" data-check>
          <label className="field">
            <span>{t.check.label}</span>
            <span className="smap__row">
              <input className="input" name="q" type="text" autoComplete="street-address" placeholder={t.check.placeholder} required />
              <button className="btn btn--ghost" type="submit">{t.check.button}</button>
            </span>
          </label>
          <div className="smap__result" data-result aria-live="polite" hidden>
            <Check size={20} weight="bold" className="smap__yes" aria-hidden />
            <WarningCircle size={20} weight="light" className="smap__no" aria-hidden />
            <p data-result-text />
            <a className="link smap__book" href={href(lang, "/book")}>{t.check.book}</a>
          </div>
        </form>
      )}
    </div>
  );
}
