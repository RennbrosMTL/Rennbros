import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { business } from "@/lib/business";
import { LANGS, alternates, dict, isLang, plain } from "@/lib/i18n";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { MobileBar } from "@/components/site/MobileBar";
import { Chrome } from "@/components/site/Chrome";
import { StructuredData } from "@/components/site/StructuredData";
import { clash, general } from "../fonts";
import "../globals.css";
import "../site.css";
import "../sections.css";
import "../pages.css";

/* Both languages are built; nothing else is a language. */
export const dynamicParams = false;
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return {
    metadataBase: new URL(`https://${business.domain.toLowerCase()}`),
    title: { default: plain(t.meta.homeTitle), template: `%s — ${business.name}` },
    description: plain(t.meta.homeDescription),
    alternates: alternates(lang, "/"),
    icons: {
      icon: [{ url: "/favicon.ico", sizes: "32x32" }, { url: "/favicon.svg", type: "image/svg+xml" }],
      apple: "/apple-touch-icon.png",
    },
    manifest: "/site.webmanifest",
    // Saved to a phone's home screen, the site opens full screen like an app.
    appleWebApp: { capable: true, title: "Renn Bros", statusBarStyle: "default" },
    openGraph: {
      siteName: business.name,
      locale: lang === "fr" ? "fr_CA" : "en_CA",
      type: "website",
      images: [{ url: "/og.jpg", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: "#f5f6f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/* Runs before first paint: marks JS as present and applies a stored dark
   theme, so a dark visit never flashes light. */
const boot = `document.documentElement.classList.add("js");try{if(localStorage.getItem("rennbros.theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dict(lang);
  return (
    <html lang={t.locale} className={`${clash.variable} ${general.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <StructuredData lang={lang} />
      </head>
      <body>
        <a className="skip" href="#main">{t.nav.skip}</a>
        <span className="edge-sentinel edge-sentinel--top" aria-hidden="true" />
        <span className="edge-sentinel edge-sentinel--fold" aria-hidden="true" />
        <SiteHeader lang={lang} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter lang={lang} />
        <MobileBar lang={lang} />
        <span className="edge-sentinel edge-sentinel--end" aria-hidden="true" />
        <Chrome label={t.nav.top} />
      </body>
    </html>
  );
}
