"use client";

import { usePathname } from "next/navigation";
import { counterpart, type Lang } from "@/lib/i18n";

/** Nav links that know which page they're on. */
export function NavLinks({ links, className }: { links: { href: string; label: string }[]; className?: string }) {
  // Rewrites can surface the internal /en/… path; compare public paths.
  const path = (usePathname() ?? "/").replace(/^\/en(?=\/|$)/, "") || "/";
  return (
    <>
      {links.map((l) => (
        <a key={l.href} className={className} href={l.href} aria-current={path === l.href || path.startsWith(`${l.href}/`) ? "page" : undefined}>
          {l.label}
        </a>
      ))}
    </>
  );
}

/** The same page in the other language. */
export function LangSwitch({ lang, short, aria, className }: { lang: Lang; short: string; aria: string; className?: string }) {
  const path = usePathname() ?? "/";
  // usePathname gives the internal /en/… path for English pages; strip it.
  const pub = path.replace(/^\/en(?=\/|$)/, "") || "/";
  const other = counterpart(lang === "fr" && !pub.startsWith("/fr") ? `/fr${pub === "/" ? "" : pub}` : pub);
  return (
    <a className={className} href={other.path} hrefLang={other.lang} lang={other.lang} aria-label={aria}>
      {short}
    </a>
  );
}
