"use client";

import Image from "next/image";
import { Check, Plus } from "@phosphor-icons/react";
import { dict, href, price, duration, servicesIn, type Lang } from "@/lib/i18n";
import { useVisit } from "@/lib/visit";
import { VisitPanel } from "./VisitPanel";
import { BeforeAfter } from "./BeforeAfter";

/**
 * The service menu: every service a product, with its photograph, price and
 * time, and a button that adds it to the visit. The visit panel beside it
 * (a sheet on phones) adds everything up and finds the next open window.
 *
 * `photos` (the home page): the on-site photographs instead of the product
 * stills, and the worn/new slider on the brakes card.
 */
/** `level`: the card headings' rank, one below the heading the menu sits under. */
export function Menu({ lang, headingId, panel = true, photos = false, level = 3 }: { lang: Lang; headingId?: string; panel?: boolean; photos?: boolean; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  const t = dict(lang);
  const m = t.home.menu;
  const { slugs, toggle } = useVisit();
  const list = servicesIn(lang);
  return (
    <div className={panel ? "menu-wrap" : undefined}>
      <ul className="menu-grid" aria-labelledby={headingId}>
        {list.map((s, i) => {
          const on = slugs.includes(s.slug);
          return (
            <li key={s.slug} className={`dish${on ? " is-on" : ""}`} data-reveal>
              {photos && s.slug === "brakes" ? (
                <div className="dish__media dish__media--ba">
                  <BeforeAfter
                    before={{ src: "/media/life/p07-worn-card.jpg", alt: t.images["p07-worn"], width: 1600, height: 1200 }}
                    after={{ src: "/media/life/p07-brakes-card.jpg", alt: t.images["p07-brakes"], width: 1600, height: 1200 }}
                    labels={t.compare}
                    sizes="(min-width: 1280px) 400px, (min-width: 700px) 45vw, 92vw"
                  />
                </div>
              ) : (
                <a className="dish__media" href={href(lang, `/services/${s.slug}`)} tabIndex={-1} aria-hidden="true">
                  <Image
                    src={photos ? `/media/life/${s.photo.name}.jpg` : `/media/${s.image}.jpg`}
                    alt=""
                    width={photos ? s.photo.width : 2400}
                    height={photos ? s.photo.height : 1792}
                    sizes="(min-width: 1280px) 400px, (min-width: 700px) 45vw, 92vw"
                    loading={!photos && i < 2 ? "eager" : undefined}
                  />
                </a>
              )}
              <div className="dish__body">
                <H className="dish__name">
                  <a href={href(lang, `/services/${s.slug}`)}>{s.name}</a>
                </H>
                {s.sub && <p className="dish__sub">{s.sub}</p>}
                <p className="dish__short">{s.short}</p>
                <div className="dish__foot">
                  <span className="dish__meta">
                    <span className="dish__price num">{price(lang, s)}</span>
                    <span className="dish__time num">{duration(lang, s.minutes)}</span>
                  </span>
                  <button
                    type="button"
                    className="dish__add"
                    aria-pressed={on}
                    aria-label={`${on ? m.added : m.add}: ${s.name}`}
                    onClick={() => toggle(s.slug)}
                  >
                    <span className="dish__add-icon" aria-hidden>{on ? <Check size={16} weight="bold" /> : <Plus size={16} weight="bold" />}</span>
                    <span>{on ? m.added : m.add}</span>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {panel && <VisitPanel lang={lang} />}
    </div>
  );
}
