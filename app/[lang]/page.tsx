import type { Metadata } from "next";
import { alternates, dict, isLang, plain, type Lang } from "@/lib/i18n";
import { Hero } from "@/components/home/Hero";
import { heroMediaFor } from "@/lib/season";
import { Menu } from "@/components/menu/Menu";
import { Marquee, Steps, Area, FaqTeaser, Closing } from "@/components/home/Sections";
import { ReviewsReel } from "@/components/home/ReviewsReel";
import { googleReviews } from "@/lib/reviews";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: { absolute: plain(t.meta.homeTitle) }, description: plain(t.meta.homeDescription), alternates: alternates(lang, "/") };
}

/** Re-rendered hourly so the seasonal hero changes on its own. */
export const revalidate = 3600;

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = dict(lang);
  const m = t.home.menu;
  // Genuine Google reviews only; the section is left out until there are some.
  const reviews = await googleReviews(lang);
  const month = new Date().getMonth();
  return (
    <>
      <Hero lang={lang} initialSeason={month >= 2 && month <= 4 ? "spring" : "winter"} media={heroMediaFor()} />
      <Marquee lang={lang} />

      <section id="menu" className="menu-section section page" aria-labelledby="menu-title">
        <div className="menu-head" data-reveal>
          <div>
            <p className="label label--red">{m.label}</p>
            <h2 className="d2" id="menu-title">{m.title}</h2>
          </div>
          <p className="lead">{m.lead}</p>
        </div>
        <Menu lang={lang} headingId="menu-title" photos />
      </section>

      <Steps lang={lang} />
      <Area lang={lang} />
      {reviews && <ReviewsReel lang={lang} data={reviews} />}
      <FaqTeaser lang={lang} />
      <Closing lang={lang} />
    </>
  );
}
