"use client";

import { useEffect, useState } from "react";
import { Phone, SealCheck } from "@phosphor-icons/react";
import { business } from "@/lib/business";
import { dict, href, type Lang } from "@/lib/i18n";
import { useVisit } from "@/lib/visit";

/** After a booking request. The reference arrives in ?ref=; a stand-in
 *  reference (DEMO-…) says so. The visit that was just booked is cleared. */
export function Received({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const r = t.pages.received;
  const [ref, setRef] = useState<string | null>(null);
  const { clear } = useVisit();
  useEffect(() => {
    const v = new URLSearchParams(location.search).get("ref");
    if (v && /^[\w-]{3,80}$/.test(v)) {
      setRef(v);
      clear();
    }
  }, [clear]);
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
        {ref?.startsWith("DEMO") && <p className="done__demo" data-demo><span className="tag">{t.draft}</span> {r.demo}</p>}
        <div className="done__more">
          <p>{r.urgent}</p>
          <a className="btn btn--ghost" href={`tel:${business.phone.tel}`}><Phone size={18} weight="light" aria-hidden /><span className="num">{business.phone.display}</span></a>
        </div>
        <a className="link" href={href(lang, "/")}>{r.back}</a>
      </div>
    </section>
  );
}
