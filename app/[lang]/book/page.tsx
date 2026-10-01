import type { Metadata } from "next";
import { alternates, dict, isLang, plain, type Lang } from "@/lib/i18n";
import { BookingForm } from "@/components/book/BookingForm";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.meta.book[0], description: plain(t.meta.book[1]), alternates: alternates(lang, "/book") };
}

export default async function Book({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const b = dict(lang).book;
  return (
    <section className="book page" aria-labelledby="book-title">
      <header className="book__head">
        <p className="label label--red">{b.label}</p>
        <h1 className="d2" id="book-title">{b.title}</h1>
        <p className="lead">{b.lead}</p>
      </header>
      <BookingForm lang={lang} />
    </section>
  );
}
