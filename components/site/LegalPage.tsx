import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { business } from "@/lib/business";
import { dict, type Lang } from "@/lib/i18n";
import { PageHead } from "./PageHead";

type Doc = "privacy" | "warranty" | "terms" | "disclosures";

/** Privacy, warranty, booking terms and disclosures: a plain-language summary
 *  of each document, with the full legal PDF (both languages) to download.
 *  Each page ends with Square's own policies, since Square processes every
 *  payment; terms and disclosures also link the office-parking consent. */
export function LegalPage({ lang, doc }: { lang: Lang; doc: Doc }) {
  const t = dict(lang);
  const p = t.pages[doc];
  const sq = t.pages.square;
  const last = p.sections.length - 1;
  const or = "or" in p ? p.or : "";
  return (
    <>
      <PageHead label={p.label} title={p.title} lead={p.lead} />
      <article className="page doc">
        <p className="doc__download">
          <a className="link" href={p.doc.href} target="_blank" rel="noopener" download><DownloadSimple size={18} weight="bold" aria-hidden />{p.doc.label}</a>
          <a className="link soft" href={p.doc.otherHref} target="_blank" rel="noopener" download lang={lang === "en" ? "fr" : "en"}>{p.doc.other}</a>
        </p>
        {p.sections.map(([h, body], i) => (
          <section key={h}>
            <h2 className="d4">{h}</h2>
            <p>
              {body}
              {i === last && doc === "privacy" && <> <a className="link" href={`mailto:${business.email}`}>{business.email}</a>.</>}
              {i === last && doc !== "privacy" && (
                <> <a className="link num" href={`tel:${business.phone.tel}`}>{business.phone.display}</a> {or} <a className="link" href={`mailto:${business.email}`}>{business.email}</a>.</>
              )}
            </p>
          </section>
        ))}
        {(doc === "terms" || doc === "disclosures") && (
          <section>
            <h2 className="d4">{t.pages.officeDoc.label.split(/ ?:/)[0]}</h2>
            <p><a className="link" href={t.pages.officeDoc.href} target="_blank" rel="noopener" download>{t.pages.officeDoc.label}</a></p>
          </section>
        )}
        <section>
          <h2 className="d4">{sq.title}</h2>
          <p>{sq.lead}</p>
          <ul className="doc__links">
            {sq.links.map(([label, href]) => (
              <li key={href}><a className="link" href={href} target="_blank" rel="noopener noreferrer">{label}</a></li>
            ))}
          </ul>
        </section>
      </article>
    </>
  );
}
