import type { Metadata } from "next";
import { Phone } from "@phosphor-icons/react/dist/ssr";
import { business } from "@/lib/business";
import { alternates, dict, href, isLang, plain, type Lang } from "@/lib/i18n";
import { PageHead } from "@/components/site/PageHead";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.meta.faq[0], description: plain(t.meta.faq[1]), alternates: alternates(lang, "/faq") };
}

export default async function Faq({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = dict(lang);
  const p = t.pages.faq;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: t.locale,
    mainEntity: p.items.map(([q, a]) => ({ "@type": "Question", name: plain(q), acceptedAnswer: { "@type": "Answer", text: plain(a) } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageHead label={p.label} title={p.title} lead={p.lead} />
      <section className="page faq-page">
        <div className="qa">
          {p.items.map(([q, a], i) => (
            <details key={q} name="faq" open={i === 0}>
              <summary><span>{q}</span><span className="qa__mark" aria-hidden /></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
        <aside className="ask">
          <p className="d4">{t.book.ratherTalk}</p>
          <a className="btn btn--ghost" href={`tel:${business.phone.tel}`}><Phone size={18} weight="light" aria-hidden /><span className="num">{business.phone.display}</span></a>
          <a className="btn btn--red" href={href(lang, "/book")}>{t.nav.book}</a>
        </aside>
      </section>
    </>
  );
}
