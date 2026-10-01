import { List, Phone, WhatsappLogo, X } from "@phosphor-icons/react/dist/ssr";
import { business, whatsappHref } from "@/lib/business";
import { dict, href, type Lang } from "@/lib/i18n";
import { Wordmark } from "./Wordmark";
import { ThemeToggle } from "./ThemeToggle";
import { NavLinks, LangSwitch } from "./NavLinks";

/**
 * The header. Server-rendered; the only client pieces are the theme toggle,
 * the language switch (it needs the current path) and the active nav state.
 * The phone menu is a native popover: it opens with or without scripts.
 */
export function SiteHeader({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const nav: [string, string][] = [
    ["/services", t.nav.services],
    ["/how-it-works", t.nav.how],
    ["/area", t.nav.area],
    ["/faq", t.nav.faq],
  ];
  const links = nav.map(([p, label]) => ({ href: href(lang, p), label }));
  return (
    <header className="head">
      <div className="head__in page">
        <a className="head__brand" href={href(lang, "/")} aria-label={`${business.name} ${business.tagline}, ${t.nav.home}`}>
          <Wordmark />
        </a>
        <nav className="head__nav" aria-label={t.nav.main}>
          <NavLinks links={links} className="head__link" />
        </nav>
        <div className="head__end">
          <ThemeToggle dark={t.nav.themeDark} light={t.nav.themeLight} />
          <LangSwitch lang={lang} short={t.other.short} aria={`${t.other.short}, ${t.other.label}`} className="head__lang" />
          <a className="head__tel" href={`tel:${business.phone.tel}`}>
            <Phone size={18} weight="light" aria-hidden />
            <span className="num">{business.phone.display}</span>
          </a>
          <a className="btn btn--red btn--sm head__book" href={href(lang, "/book")}>{t.nav.book}</a>
          <button className="head__menu" type="button" popoverTarget="site-menu" aria-label={t.nav.menu}>
            <List size={24} weight="light" aria-hidden />
          </button>
        </div>
      </div>

      <div id="site-menu" className="menu" popover="auto">
        <div className="menu__top page">
          <Wordmark />
          <button className="head__menu" type="button" popoverTarget="site-menu" popoverTargetAction="hide" aria-label={t.nav.close}>
            <X size={24} weight="light" aria-hidden />
          </button>
        </div>
        <nav className="menu__nav page" aria-label={t.nav.main}>
          <a href={href(lang, "/")}>{t.nav.home}</a>
          <NavLinks links={links} />
        </nav>
        <div className="menu__foot page">
          <a className="btn btn--red" href={href(lang, "/book")}>{t.nav.book}</a>
          <a className="btn btn--ghost" href={`tel:${business.phone.tel}`}>
            <Phone size={18} weight="light" aria-hidden />
            <span className="num">{business.phone.display}</span>
          </a>
          <a className="btn btn--ghost" href={whatsappHref(t.nav.whatsappHello)} target="_blank" rel="noopener noreferrer">
            <WhatsappLogo size={18} weight="light" aria-hidden />
            {t.nav.whatsapp}
          </a>
          <LangSwitch lang={lang} short={t.other.label} aria={t.other.label} className="menu__lang link" />
        </div>
      </div>
    </header>
  );
}
