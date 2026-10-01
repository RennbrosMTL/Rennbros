"use client";

import { usePathname } from "next/navigation";
import { dict, href } from "@/lib/i18n";
import { Menu } from "@/components/menu/Menu";

/** A page that doesn't exist, inside the site: say so, then show the menu. */
export default function NotFound() {
  const path = usePathname() ?? "/";
  const lang = path === "/fr" || path.startsWith("/fr/") ? "fr" : "en";
  const t = dict(lang);
  const n = t.pages.notFound;
  return (
    <>
      <section className="page nf" aria-labelledby="nf-title">
        <p className="label label--red">404</p>
        <h1 className="d1" id="nf-title">{n.title}</h1>
        <p className="lead">{n.lead}</p>
        <div className="nf__ctas">
          <a className="btn btn--red" href={href(lang, "/")}>{t.nav.home}</a>
          <a className="btn btn--ghost" href={href(lang, "/book")}>{t.nav.book}</a>
        </div>
      </section>
      <section className="page section">
        <Menu lang={lang} panel={false} />
      </section>
    </>
  );
}
