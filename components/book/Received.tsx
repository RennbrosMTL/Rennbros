"use client";

import { useEffect, useState } from "react";
import { AppleLogo, CalendarPlus, GoogleLogo, Phone, SealCheck, WhatsappLogo } from "@phosphor-icons/react";
import { business } from "@/lib/business";
import { dict, href, type Lang } from "@/lib/i18n";
import { useVisit } from "@/lib/visit";
import { VISIT_KEY, googleLink, icsFile, type CalendarEvent, type LastVisit } from "@/lib/book/calendar";
import { whatsappHref } from "@/lib/business";

/** After a booking request. The reference arrives in ?ref=; a stand-in
 *  reference (DEMO-…) says so. The visit that was just booked is cleared. */
export function Received({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const r = t.pages.received;
  const [ref, setRef] = useState<string | null>(null);
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const { clear } = useVisit();
  useEffect(() => {
    const v = new URLSearchParams(location.search).get("ref");
    if (v && /^[\w-]{3,80}$/.test(v)) {
      setRef(v);
      clear();
      try {
        const last = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? "null") as LastVisit | null;
        if (last && last.ref === v && !Number.isNaN(Date.parse(last.startAt))) {
          const start = new Date(last.startAt);
          setEvent({
            title: r.event(last.title),
            start,
            end: new Date(start.getTime() + last.minutes * 60_000),
            details: r.eventDetails(v, business.phone.display),
            location: last.address,
          });
        }
      } catch {}
    }
  }, [clear, r]);
  return (
    <section className="page done" aria-labelledby="done-title">
      <div className="done__card">
        <span className="done__seal"><SealCheck size={40} weight="light" aria-hidden /></span>
        <p className="label label--red">{r.label}</p>
        <h1 className="d2" id="done-title">{r.title}</h1>
        <p className="lead">{r.lead}</p>
        {ref && (
          <div className="done__ref" data-ref>
            <span className="label">{r.ref}</span>
            <span className="done__code num" data-ref-code>{ref}</span>
          </div>
        )}
        {event && ref && (
          <div className="done__cal" data-cal>
            <p className="label"><CalendarPlus size={16} weight="light" aria-hidden /> {r.calendar}</p>
            <div className="done__cal-btns">
              <a className="btn btn--ghost" href={googleLink(event)} target="_blank" rel="noopener noreferrer"><GoogleLogo size={18} weight="bold" aria-hidden />{r.google}</a>
              <a className="btn btn--ghost" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(icsFile(event, ref))}`} download={`renn-bros-${ref}.ics`}><AppleLogo size={18} weight="fill" aria-hidden />{r.apple}</a>
            </div>
          </div>
        )}
        {ref?.startsWith("DEMO") && <p className="done__demo" data-demo><span className="tag">{t.draft}</span> {r.demo}</p>}
        <div className="done__more">
          <p>{r.urgent}</p>
          <div className="done__cal-btns">
          <a className="btn btn--ghost" href={`tel:${business.phone.tel}`}><Phone size={18} weight="light" aria-hidden /><span className="num">{business.phone.display}</span></a>
          <a className="btn btn--ghost" href={whatsappHref(t.nav.whatsappHello)} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={18} weight="light" aria-hidden />{t.nav.whatsapp}</a>
          </div>
        </div>
        <a className="link" href={href(lang, "/")}>{r.back}</a>
      </div>
    </section>
  );
}
