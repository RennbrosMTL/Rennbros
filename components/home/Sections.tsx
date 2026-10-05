import { ArrowRight, Phone } from "@phosphor-icons/react/dist/ssr";
import { business } from "@/lib/business";
import { dict, href, town, type Lang } from "@/lib/i18n";
import { ServiceMap } from "@/components/map/ServiceMap";

/** "Trusted by owners of": a slow band, fading in and out at its edges. CSS
 *  only; four copies so it is always full, moving one copy per loop. */
export function Marquee({ lang }: { lang: Lang }) {
  const m = dict(lang).home.marquee;
  return (
    <section className="mq" aria-label={m.label}>
      <p className="page mq__label label">{m.label}</p>
      <div className="mq__window">
        <ul className="mq__track">
          {[0, 1, 2, 3].flatMap((copy) =>
            m.items.map((x) => (
              <li key={`${copy}-${x}`} aria-hidden={copy > 0 ? true : undefined}>{x}</li>
            )),
          )}
        </ul>
      </div>
    </section>
  );
}

/** How a visit goes, in three steps on one line. */
export function Steps({ lang }: { lang: Lang }) {
  const s = dict(lang).home.steps;
  return (
    <section className="steps section page" aria-labelledby="steps-title">
      <div className="steps__head" data-reveal>
        <p className="label label--red">{s.label}</p>
        <h2 className="d2" id="steps-title">{s.title}</h2>
      </div>
      <ol className="steps__list">
        {s.items.map(([title, body], i) => (
          <li key={title} className="hstep" data-reveal>
            <span className="hstep__n" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
            <h3 className="d4">{title}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ol>
      <p className="steps__more"><a className="link" href={href(lang, "/how-it-works")}>{s.more}</a></p>
    </section>
  );
}

/** Where we work: the towns (each one flies the map there) and the map. */
export function Area({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const a = t.home.area;
  return (
    <section className="area section page" aria-labelledby="area-title">
      <div className="area__text" data-reveal>
        <p className="label label--red">{a.label}</p>
        <h2 className="d2" id="area-title">{a.title}</h2>
        <p className="lead">{a.lead}</p>
        <div className="area__block">
          <p className="label">{a.regionsLabel}</p>
          <ul className="chips">
            {a.regions.map((r) => (
              <li key={r}><span className="chip chip--static">{r}</span></li>
            ))}
          </ul>
          <a className="link" href={href(lang, "/area")}>{t.pages.area.title.replace(/\.$/, "")} →</a>
        </div>
        <div className="area__block">
          <p className="label">{a.hours}</p>
          <p>{t.business.weekdays}<br />{t.business.weekends}</p>
        </div>
        {business.area.isPlaceholder && <p className="area__pending"><span className="tag">{t.draft}</span> {a.pending}</p>}
      </div>
      <ServiceMap lang={lang} />
    </section>
  );
}

/** The four questions people ask first; the rest are one click away. */
export function FaqTeaser({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const f = t.home.faq;
  return (
    <section className="faqt section page" aria-labelledby="faqt-title">
      <div className="faqt__head" data-reveal>
        <p className="label label--red">{f.label}</p>
        <h2 className="d2" id="faqt-title">{f.title}</h2>
        <a className="link" href={href(lang, "/faq")}>{f.more}</a>
      </div>
      <div className="qa">
        {t.pages.faq.items.slice(0, 4).map(([q, a], i) => (
          <details key={q} name="faq-home" open={i === 0}>
            <summary><span>{q}</span><span className="qa__mark" aria-hidden /></summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Closing({ lang }: { lang: Lang }) {
  const c = dict(lang).home.closing;
  return (
    <section className="close page" aria-labelledby="close-title">
      <div className="close__panel" data-reveal>
        <span className="close__rb" aria-hidden />
        <h2 className="d2" id="close-title">{c.title}</h2>
        <p className="lead">{c.lead}</p>
        <div className="close__ctas">
          <a className="btn btn--red" href={href(lang, "/book")}>
            {c.primary}
            <ArrowRight size={16} weight="bold" className="arrow" aria-hidden />
          </a>
          <a className="btn btn--ghost" href={`tel:${business.phone.tel}`}>
            <Phone size={18} weight="light" aria-hidden />
            {c.call} <span className="num">{business.phone.display}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
