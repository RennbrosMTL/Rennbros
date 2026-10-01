import type { Metadata } from "next";
import { business } from "@/lib/business";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";
import { Wordmark } from "@/components/site/Wordmark";
import { clash, general } from "./fonts";
import "./globals.css";
import "./site.css";
import "./sections.css";
import "./pages.css";

/**
 * The 404 for a URL that matches no page in either language. It renders
 * outside every layout (the root layout lives in app/[lang]), so it cannot
 * know the language: it says everything twice, English first, as a bilingual
 * Québec sign would.
 */
export const metadata: Metadata = {
  title: `${en.meta.notFound} · ${fr.meta.notFound} — ${business.name}`,
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en-CA" className={`${clash.variable} ${general.variable}`}>
      <body className="no-bar">
        <header className="head">
          <div className="head__in page">
            <a className="head__brand" href="/" aria-label={`${business.name} ${business.tagline}`}><Wordmark /></a>
          </div>
        </header>
        <main className="page nf nf--global">
          <p className="label label--red">404</p>
          <h1 className="d2">{en.pages.notFound.title}</h1>
          <p className="lead">{en.pages.notFound.lead}</p>
          <h2 className="d3" lang="fr-CA">{fr.pages.notFound.title}</h2>
          <p className="lead" lang="fr-CA">{fr.pages.notFound.lead}</p>
          <div className="nf__ctas">
            <a className="btn btn--red" href="/">{en.nav.home}</a>
            <a className="btn btn--ghost" href="/fr" lang="fr-CA">{fr.nav.home}</a>
          </div>
        </main>
      </body>
    </html>
  );
}
