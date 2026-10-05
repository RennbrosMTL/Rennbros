import { business } from "@/lib/business";
import { dict, type Lang } from "@/lib/i18n";
import { PageHead } from "./PageHead";

/** Privacy, warranty and booking terms: short documents, one template. Each
 *  ends with Square's own policies (they process every payment), and the
 *  booking terms also link the office-parking consent and disclosure. */
export function LegalPage({ lang, doc }: { lang: Lang; doc: "privacy" | "warranty" | "terms" }) {
  const t = dict(lang);
  const p = t.pages[doc];
  const sq = t.pages.square;
  const last = p.sections.length - 1;
  return (
    <>
      <PageHead label={p.label} title={p.title} lead={"lead" in p ? p.lead : undefined} />
      <article className="page doc">
        {p.sections.map(([h, body], i) => (
          <section key={h}>
            <h2 className="d4">{h}</h2>
            <p>
              {body}
              {i === last && doc === "privacy" && <> <a className="link" href={`mailto:${business.email}`}>{business.email}</a>.</>}
              {i === last && doc !== "privacy" && (
                <> <a className="link num" href={`tel:${business.phone.tel}`}>{business.phone.display}</a> {t.pages[doc === "terms" ? "terms" : "warranty"].or} <a className="link" href={`mailto:${business.email}`}>{business.email}</a>.</>
              )}
            </p>
          </section>
        ))}
        {doc === "terms" && (
          <section>
            <h2 className="d4">{t.pages.officeDoc.label.split(":")[0]}</h2>
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
