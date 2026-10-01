import type { Metadata } from "next";
import { alternates, dict, isLang, plain, type Lang } from "@/lib/i18n";
import { PageHead } from "@/components/site/PageHead";
import { Menu } from "@/components/menu/Menu";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.meta.services[0], description: plain(t.meta.services[1]), alternates: alternates(lang, "/services") };
}

export default async function Services({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = dict(lang);
  const p = t.pages.services;
  return (
    <>
      <PageHead label={p.label} title={p.title} lead={p.lead} />
      <section className="page" aria-labelledby="page-title">
        <Menu lang={lang} headingId="page-title" level={2} />
        <section className="notes" aria-labelledby="notes-title">
          <h2 className="d3" id="notes-title">{p.notesTitle}</h2>
          <dl>
            {p.notes.map(([k, v]) => (
              <div key={k}><dt className="d4">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>
      </section>
    </>
  );
}
