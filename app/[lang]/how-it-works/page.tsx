import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, CalendarCheck, ChatCircleText, HandTap, Key, ShieldCheck, Toolbox } from "@phosphor-icons/react/dist/ssr";
import { business } from "@/lib/business";
import { alternates, dict, href, isLang, plain, type Lang } from "@/lib/i18n";
import { PageHead } from "@/components/site/PageHead";
import { heroMediaFor } from "@/lib/season";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.meta.how[0], description: plain(t.meta.how[1]), alternates: alternates(lang, "/how-it-works") };
}

/** Re-rendered hourly so the seasonal picture changes on its own. */
export const revalidate = 3600;

const ICONS = [HandTap, ChatCircleText, Toolbox, CalendarCheck, Key];

/** From booking to keys back: the five moments, then what we need from you. */
export default async function How({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = dict(lang);
  const h = t.pages.how;
  const heroMedia = heroMediaFor();
  return (
    <>
      <PageHead label={h.label} title={h.title} lead={h.lead} />
      <section className="page">
        <figure className="how__banner">
          <Image src={heroMedia.still} alt={t.images[heroMedia.alt]} width={2752} height={1536} sizes="(min-width: 1280px) 1216px, 94vw" loading="eager" fetchPriority="high" />
        </figure>
        <ol className="how__flow">
          {h.steps.map(([title, body], i) => {
            const Icon = ICONS[i];
            return (
              <li key={title} className="how__step" data-reveal>
                <span className="how__n num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <span className="how__icon" aria-hidden><Icon size={26} weight="light" /></span>
                <h2 className="d4">{title}</h2>
                <p>{body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="page section" aria-labelledby="ready-title">
        <h2 className="d2" id="ready-title">{h.readyTitle}</h2>
        <div className="ready">
          {h.ready.map(([title, body]) => (
            <div key={title} className="ready__item" data-reveal>
              <h3 className="d4">{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page" aria-labelledby="after-title">
        <div className="after" data-reveal>
          <ShieldCheck size={36} weight="light" aria-hidden />
          <div>
            <h2 className="d3" id="after-title">{h.afterTitle}</h2>
            <p className="lead">{h.after}</p>
          </div>
          <div className="after__ctas">
            <a className="btn btn--red" href={href(lang, "/book")}>{h.cta}<ArrowRight size={16} weight="bold" className="arrow" aria-hidden /></a>
            <a className="btn btn--ghost num" href={`tel:${business.phone.tel}`}>{business.phone.display}</a>
          </div>
        </div>
      </section>
    </>
  );
}
