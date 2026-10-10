import { FacebookLogo, InstagramLogo, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { business } from "@/lib/business";
import { dict, href, servicesIn, type Lang } from "@/lib/i18n";
import { Wordmark } from "./Wordmark";

const SOCIAL = { instagram: InstagramLogo, facebook: FacebookLogo, whatsapp: WhatsappLogo } as const;

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = dict(lang);
  return (
    <footer className="foot">
      <div className="page foot__in">
        <div className="foot__brand">
          <Wordmark />
          <p className="foot__tag">{t.footer.tag}</p>
          <a className="btn btn--red" href={href(lang, "/book")}>{t.nav.book}</a>
          <div className="foot__follow">
            <p className="label">{t.footer.follow}</p>
            <ul className="foot__social">
              {business.social.links.map((s) => {
                const Icon = SOCIAL[s.icon as keyof typeof SOCIAL];
                return (
                  <li key={s.name}>
                    <a href={s.href} rel="noopener" target="_blank" aria-label={s.name}>
                      <Icon size={20} weight="light" aria-hidden />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <nav className="foot__col" aria-label={t.footer.services}>
          <p className="label">{t.footer.services}</p>
          <ul>
            {servicesIn(lang).map((s) => (
              <li key={s.slug}><a className="link" href={href(lang, `/services/${s.slug}`)}>{s.name}</a></li>
            ))}
          </ul>
        </nav>

        <nav className="foot__col" aria-label={t.footer.visit}>
          <p className="label">{t.footer.visit}</p>
          <ul>
            <li><a className="link" href={href(lang, "/how-it-works")}>{t.nav.how}</a></li>
            <li><a className="link" href={href(lang, "/area")}>{t.nav.area}</a></li>
            <li><a className="link" href={href(lang, "/faq")}>{t.nav.faq}</a></li>
            <li><a className="link" href={href(lang, "/legal/warranty")}>{t.footer.warranty}</a></li>
            <li><a className="link" href={href(lang, "/legal/terms")}>{t.footer.terms}</a></li>
            <li><a className="link" href={href(lang, "/legal/privacy")}>{t.footer.privacy}</a></li>
            <li><a className="link" href={href(lang, "/legal/disclosures")}>{t.footer.disclosures}</a></li>
          </ul>
        </nav>

        <div className="foot__col">
          <p className="label">{t.footer.contact}</p>
          <ul>
            <li><a className="link num" href={`tel:${business.phone.tel}`}>{business.phone.display}</a></li>
            <li><a className="link" href={`mailto:${business.email}`}>{business.email}</a></li>
          </ul>
          <p className="foot__hours">{t.business.weekdays}<br />{t.business.weekends}</p>
        </div>
      </div>
      <div className="page foot__base">
        <p>© {new Date().getFullYear()} {business.name} · {business.legal.name} · NEQ {business.legal.neq} · {t.footer.rights}</p>
        <p className="foot__square">
          {t.footer.squareLabel}{" "}
          {t.pages.square.links.map(([, url], i) => (
            <span key={url}>{i > 0 && " · "}<a className="link" href={url} target="_blank" rel="noopener noreferrer">{[t.footer.squarePrivacy, t.footer.squareTerms, t.footer.squarePayment][i]}</a></span>
          ))}
        </p>
      </div>
    </footer>
  );
}
