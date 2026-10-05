import type { Metadata } from "next";
import { ChatText, EnvelopeSimple, MapPin, Phone } from "@phosphor-icons/react/dist/ssr";
import { business } from "@/lib/business";
import { alternates, dict, href, isLang, plain, town, type Lang } from "@/lib/i18n";
import { PageHead } from "@/components/site/PageHead";
import { ServiceMap } from "@/components/map/ServiceMap";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.meta.area[0], description: plain(t.meta.area[1]), alternates: alternates(lang, "/area") };
}

export default async function Area({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = dict(lang);
  const p = t.pages.area;
  const towns = business.area.towns.map((n) => [n, town(lang, n)] as const).sort((a, b) => a[1].localeCompare(b[1], t.locale));
  return (
    <>
      <PageHead label={p.label} title={p.title} lead={p.lead} />
      <section className="page area-page">
        <ServiceMap lang={lang} />
        <aside className="area-side">
          <div className="area__block">
            <p className="label">{t.home.area.towns}</p>
            <ul className="towns">
              {towns.map(([key, name]) => (
                <li key={key}>
                  <button type="button" className="town" data-town={key} aria-pressed="false" disabled>
                    <MapPin size={16} weight="light" aria-hidden />{name}
                  </button>
                </li>
              ))}
            </ul>
            {business.area.isPlaceholder && <p className="area__pending"><span className="tag">{t.draft}</span> {t.home.area.pending}</p>}
          </div>
          <div className="area__block">
            <p className="label">{t.home.area.hours}</p>
            <p>{t.business.weekdays}<br />{t.business.weekends}</p>
            <p className="soft">{t.business.afterHours}</p>
          </div>
          <div className="area__block area__outside">
            <p className="label">{p.outsideTitle}</p>
            <p>{p.outside}</p>
          </div>
          <div className="area__block">
            <p className="label">{p.contact}</p>
            <ul className="contact">
              <li><Phone size={18} weight="light" aria-hidden /><a className="link num" href={`tel:${business.phone.tel}`}>{business.phone.display}</a></li>
              <li><ChatText size={18} weight="light" aria-hidden /><a className="link" href={`sms:${business.phone.tel}`}>{p.text}</a></li>
              <li><EnvelopeSimple size={18} weight="light" aria-hidden /><a className="link" href={`mailto:${business.email}`}>{business.email}</a></li>
            </ul>
          </div>
          <a className="btn btn--red" href={href(lang, "/book")}>{t.nav.book}</a>
        </aside>
      </section>
    </>
  );
}
