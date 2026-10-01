import { business } from "@/lib/business";
import { dict, type Lang } from "@/lib/i18n";
import { PageHead } from "./PageHead";

/** Privacy, warranty and booking terms: short documents, one template. */
export function LegalPage({ lang, doc }: { lang: Lang; doc: "privacy" | "warranty" | "terms" }) {
  const t = dict(lang);
  const p = t.pages[doc];
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
        <p className="draft"><span className="tag">{t.draft}</span> {p.draft}</p>
      </article>
    </>
  );
}
