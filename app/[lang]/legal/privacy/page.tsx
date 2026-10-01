import type { Metadata } from "next";
import { alternates, dict, isLang, plain, type Lang } from "@/lib/i18n";
import { LegalPage } from "@/components/site/LegalPage";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const m = dict(lang).meta.privacy;
  return { title: m[0], description: plain(m[1]), alternates: alternates(lang, "/legal/privacy") };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <LegalPage lang={(await params).lang as Lang} doc="privacy" />;
}
