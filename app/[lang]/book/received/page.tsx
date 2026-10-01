import type { Metadata } from "next";
import { dict, isLang, type Lang } from "@/lib/i18n";
import { Received } from "@/components/book/Received";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: dict(lang).meta.received[0], robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <Received lang={(await params).lang as Lang} />;
}
