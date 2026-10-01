"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChatText, Phone, WhatsappLogo } from "@phosphor-icons/react";
import { business, whatsappHref } from "@/lib/business";
import { dict, href, type Lang } from "@/lib/i18n";

/**
 * Phones only: call, text, WhatsApp and book, always in reach (book on the
 * right, under the thumb). Not on the booking pages,
 * where it would only repeat the page and cover the form's own buttons.
 */
export function MobileBar({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const path = (usePathname() ?? "/").replace(/^\/(en|fr)(?=\/|$)/, "") || "/";
  const onBook = path.startsWith("/book");
  useEffect(() => {
    document.body.classList.toggle("no-bar", onBook);
  }, [onBook]);
  if (onBook) return null;
  return (
    <nav className="bar" aria-label={t.nav.quick}>
      <a className="bar__side" href={`tel:${business.phone.tel}`}><Phone size={20} weight="light" aria-hidden />{t.nav.call}</a>
      <a className="bar__side" href={`sms:${business.phone.tel}`}><ChatText size={20} weight="light" aria-hidden />{t.nav.text}</a>
      <a className="bar__side" href={whatsappHref(t.nav.whatsappHello)} target="_blank" rel="noopener noreferrer" aria-label={t.nav.whatsappLabel}><WhatsappLogo size={20} weight="light" aria-hidden />{t.nav.whatsapp}</a>
      <a className="btn btn--red bar__book" href={href(lang, "/book")}>{t.nav.book}</a>
    </nav>
  );
}
