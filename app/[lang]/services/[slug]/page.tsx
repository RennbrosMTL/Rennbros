import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, CaretRight, Check, Phone } from "@phosphor-icons/react/dist/ssr";
import { business } from "@/lib/business";
import { services, bySlug, TIRE_CHOICES } from "@/lib/services";
import { LANGS, alternates, dict, href, isLang, money, moneyRange, plain, price, duration, withTravel, serviceIn, servicesIn, type Lang } from "@/lib/i18n";
import { AddToVisit } from "@/components/menu/AddToVisit";
import { VisitPanel } from "@/components/menu/VisitPanel";

export const dynamicParams = false;
export function generateStaticParams() {
  return LANGS.flatMap((lang) => services.map((s) => ({ lang, slug: s.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const s = serviceIn(lang, slug);
  if (!s) return {};
  return { title: dict(lang).meta.serviceTitle(s.name), description: plain(s.long), alternates: alternates(lang, `/services/${slug}`) };
}

/** A service as a product page: the photograph, the price, the time, what's
 *  in it, and two ways to act: add it to the visit, or book it now. */
export default async function Service({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang: l, slug } = await params;
  const lang = l as Lang;
  const t = dict(lang);
  const p = t.pages.service;
  const s = serviceIn(lang, slug);
  if (!s) notFound();
  const others = servicesIn(lang).filter((o) => o.slug !== slug);
  return (
    <>
      <article className="product page" aria-labelledby="product-title">
        <nav className="crumb" aria-label={t.nav.crumbs}>
          <a className="link" href={href(lang, "/services")}>{p.crumb}</a>
          <CaretRight size={14} weight="light" aria-hidden />
          <span aria-current="page">{s.name}</span>
        </nav>
        <div className="product__grid">
          <figure className="product__media">
            <Image src={`/media/${s.image}.jpg`} alt={t.images[s.image]} width={2400} height={1792} sizes="(min-width: 1024px) 50vw, 92vw" loading="eager" fetchPriority="high" />
          </figure>
          <div className="product__info">
            <h1 className="d2" id="product-title">{s.name}</h1>
            {s.sub && <p className="product__sub">{s.sub}</p>}
            <p className="lead">{s.long}</p>
            <dl className="product__facts">
              <div><dt>{p.price}</dt><dd className="num">{s.pricing.kind === "tiers" ? moneyRange(lang, s.pricing.tiers[0].price, s.pricing.tiers[s.pricing.tiers.length - 1].price) : price(lang, s)}</dd><dd className="product__note">{p.priceNote[s.pricing.kind]}</dd></div>
              <div><dt>{p.time}</dt><dd className="num">{duration(lang, s.minutes)}</dd><dd className="product__note">{p.window(duration(lang, withTravel(s.minutes)))}</dd></div>
              <div><dt>{p.warranty}</dt><dd>{p.oneYear}</dd><dd className="product__note">{p.onParts}</dd></div>
            </dl>
            <div className="product__ctas">
              <a className="btn btn--red" href={`${href(lang, "/book")}?service=${slug}`}>
                {p.book}
                <ArrowRight size={16} weight="bold" className="arrow" aria-hidden />
              </a>
              <AddToVisit slug={slug} add={t.home.menu.add} added={t.home.menu.added} name={s.name} />
              <a className="product__call link" href={`tel:${business.phone.tel}`}><Phone size={16} weight="light" aria-hidden /> {p.call}</a>
            </div>
            {s.pricing.kind === "tiers" && (
              <section className="rims" aria-labelledby="rims-title">
                <h2 className="label" id="rims-title">{p.byRim}</h2>
                <ul className="rims__grid">
                  {s.pricing.tiers.map((r) => (
                    <li key={r.rim}><span>{t.fmt.rims[r.rim]}</span><strong className="num">{money(lang, r.price)}</strong></li>
                  ))}
                </ul>
                <p className="rims__extra">{p.runFlat} <span className="num">+{money(lang, s.pricing.runFlat)}</span></p>
              </section>
            )}
            {(TIRE_CHOICES as readonly string[]).includes(slug) && (
              <section className="which" aria-labelledby="which-title">
                <h2 className="label" id="which-title">{p.which}</h2>
                <ul>
                  {TIRE_CHOICES.map((c) => {
                    const o = serviceIn(lang, c)!;
                    return (
                      <li key={c} aria-current={c === slug ? "true" : undefined}>
                        <p>{c === "tires" ? p.whichSwap : p.whichMount}</p>
                        {c === slug ? <strong>{o.name}</strong> : <a className="link" href={href(lang, `/services/${c}`)}>{o.name}</a>}
                        <span className="num">{price(lang, bySlug(c)!)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <section className="product__incl" aria-labelledby="incl-title">
              <h2 className="label" id="incl-title">{p.included}</h2>
              <ul>
                {s.included.map((x) => (
                  <li key={x}><Check size={18} weight="bold" aria-hidden />{x}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </article>

      <section className="page section others" aria-labelledby="others-title">
        <h2 className="d3" id="others-title">{p.others}</h2>
        <ul className="others__row">
          {others.map((o) => (
            <li key={o.slug}>
              <a className="mini" href={href(lang, `/services/${o.slug}`)}>
                <span className="mini__img"><Image src={`/media/${o.image}.jpg`} alt="" width={2400} height={1792} sizes="220px" /></span>
                <span className="mini__name">{o.name}</span>
                <span className="mini__price num">{price(lang, o)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <VisitPanel lang={lang} floating />
    </>
  );
}
