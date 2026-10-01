"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarBlank, CaretUp, X } from "@phosphor-icons/react";
import { business } from "@/lib/business";
import { dict, href, money, price, duration, serviceIn, type Lang } from "@/lib/i18n";
import { useVisit } from "@/lib/visit";

const TZ = "America/Toronto";
type Slot = { startAt: string; minutes: number };

/**
 * The estimate. Price and time add up locally; the next open window comes
 * from the booking calendar (Square, or the stand-in, same endpoint), asked
 * again whenever the services change. On a phone it is a sheet above the
 * action bar: a one-line summary that opens to the full panel.
 */
export function VisitPanel({ lang, floating = false }: { lang: Lang; floating?: boolean }) {
  const t = dict(lang);
  const v = t.home.visit;
  const { slugs, remove, clear } = useVisit();
  const [next, setNext] = useState<{ key: string; slot: Slot | null; state: "idle" | "loading" | "done" | "error" }>({ key: "", slot: null, state: "idle" });
  const [open, setOpen] = useState(false);

  const list = useMemo(() => slugs.map((s) => serviceIn(lang, s)!).filter(Boolean), [slugs, lang]);
  const sum = list.reduce((n, s) => n + s.priceFrom, 0);
  const minutes = list.reduce((n, s) => n + s.minutes, 0);
  const total = list.length ? (list.every((s) => s.exact) ? money(lang, sum) : `${t.fmt.from} ${money(lang, sum)}`) : "";
  const key = slugs.join(",");

  useEffect(() => {
    if (!key) return;
    let live = true;
    setNext({ key, slot: null, state: "loading" });
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/availability?services=${encodeURIComponent(key)}&days=31`);
        if (!r.ok) throw new Error(String(r.status));
        const data: { slots: Slot[] } = await r.json();
        if (live) setNext({ key, slot: data.slots[0] ?? null, state: "done" });
      } catch {
        if (live) setNext({ key, slot: null, state: "error" });
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key]);

  useEffect(() => {
    if (!list.length) setOpen(false);
  }, [list.length]);

  const when = (iso: string) => {
    const d = new Date(iso);
    const day = new Intl.DateTimeFormat(t.locale, { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d);
    const time = new Intl.DateTimeFormat(t.locale, { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
    return `${day.replace(/\./g, "")} · ${time}`;
  };
  const nextText =
    next.key !== key || next.state === "loading" ? v.finding : next.slot ? when(next.slot.startAt) : next.state === "error" ? t.book.when.error : v.none;
  const bookHref = `${href(lang, "/book")}${key ? `?service=${key}` : ""}`;

  return (
    <aside className={`visit${floating ? " visit--float" : ""}${list.length ? " has-items" : ""}`} aria-label={v.title} data-open={open}>
      {/* Phone summary line */}
      <button type="button" className="visit__bar" onClick={() => setOpen((o) => !o)} aria-expanded={open} hidden={!list.length}>
        <span className="visit__bar-count">{v.count(list.length)}</span>
        <span className="visit__bar-total num">{total}</span>
        <CaretUp size={18} weight="bold" className="visit__caret" aria-hidden />
      </button>

      <div className="visit__card">
        <div className="visit__head">
          <p className="visit__title">{v.title}</p>
          {list.length > 0 && <button type="button" className="visit__clear" onClick={clear}>{v.clear}</button>}
        </div>

        {list.length === 0 ? (
          <p className="visit__empty">{v.empty}</p>
        ) : (
          <>
            <ul className="visit__list">
              {list.map((s) => (
                <li key={s.slug}>
                  <span className="visit__name">{s.name}</span>
                  <span className="visit__price num">{price(lang, s)}</span>
                  <button type="button" className="visit__remove" onClick={() => remove(s.slug)} aria-label={v.remove(s.name)}>
                    <X size={14} weight="bold" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <dl className="visit__sums">
              <div><dt>{v.total}</dt><dd className="visit__total num">{total}</dd></div>
              <div><dt>{v.time}</dt><dd className="num">{duration(lang, minutes)}<span className="visit__plus"> {v.travel(duration(lang, business.booking.travelMinutes))}</span></dd></div>
              <div className="visit__next">
                <dt><CalendarBlank size={16} weight="light" aria-hidden /> {v.next}</dt>
                <dd className="num" aria-live="polite">{nextText}</dd>
              </div>
            </dl>
            <a className="btn btn--red visit__book" href={bookHref}>
              {v.book}
              <ArrowRight size={16} weight="bold" className="arrow" aria-hidden />
            </a>
            <p className="visit__note">{v.note}</p>
          </>
        )}
      </div>
    </aside>
  );
}
