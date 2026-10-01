/**
 * Two languages, one shape. English at clean URLs (/services), French under
 * /fr (/fr/services). Every page is app/[lang]/…; next.config.ts rewrites the
 * clean English URLs onto the en branch and redirects /en/… back to them.
 */
import { en } from "./en";
import { fr } from "./fr";
import { services as base, type Service as BaseService, type Pricing } from "@/lib/services";
import { business } from "@/lib/business";

export type Dict = typeof en;
export const LANGS = ["en", "fr"] as const;
export type Lang = (typeof LANGS)[number];
export const isLang = (v: string): v is Lang => (LANGS as readonly string[]).includes(v);
export const dict = (lang: Lang): Dict => (lang === "fr" ? fr : en);

/** A site path in a language: href("fr", "/services") -> "/fr/services". */
export const href = (lang: Lang, path: string) => (lang === "fr" ? (path === "/" ? "/fr" : `/fr${path}`) : path);

/** The same page in the other language, from a public pathname. */
export const counterpart = (pathname: string): { lang: Lang; path: string } => {
  const isFr = pathname === "/fr" || pathname.startsWith("/fr/");
  const bare = isFr ? pathname.replace(/^\/fr/, "") || "/" : pathname;
  return isFr ? { lang: "en", path: bare } : { lang: "fr", path: href("fr", bare) };
};

export type Service = BaseService & { name: string; /** A second line under the name (the tyre services: wheels / tyres). */ sub: string; short: string; long: string; included: string[] };

export const servicesIn = (lang: Lang): Service[] =>
  base.map((s) => ({ ...s, ...dict(lang).services[s.slug as keyof Dict["services"]] }));

export const serviceIn = (lang: Lang, slug: string) => servicesIn(lang).find((s) => s.slug === slug);

/** "from $149" / "$149"; in Québec French "à partir de 149 $" / "149 $". */
export const money = (lang: Lang, dollars: number, cents = false) => {
  const o = cents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined;
  return lang === "fr" ? `${dollars.toLocaleString("fr-CA", o)} $` : `$${dollars.toLocaleString("en-CA", o)}`;
};

/** A span, "$150–$220" / "150 $ – 220 $". */
export const moneyRange = (lang: Lang, a: number, b: number) =>
  lang === "fr" ? `${a.toLocaleString("fr-CA")} $ – ${b.toLocaleString("fr-CA")} $` : `$${a.toLocaleString("en-CA")}–$${b.toLocaleString("en-CA")}`;

/** The price the way Renn Bros' price list writes it: "$125/h + parts",
 *  "$125 per call", "$150–$220 + refrigerant", "$100–$160 · set of 4". */
export const price = (lang: Lang, s: { pricing: Pricing }) => {
  const f = dict(lang).fmt;
  const p = s.pricing;
  switch (p.kind) {
    case "hourly":
      return `${money(lang, p.rate)}${f.perHour} ${f.plusParts}`;
    case "call":
      return `${money(lang, p.amount)} ${f.perCall}`;
    case "range":
      return [moneyRange(lang, p.min, p.max), p.plus && f.plus[p.plus]].filter(Boolean).join(" ");
    case "tiers":
      return `${moneyRange(lang, p.tiers[0].price, p.tiers[p.tiers.length - 1].price)} · ${f.setOf4}`;
  }
};

/** "1 hr 30 min" / "1 h 30". */
export const duration = (lang: Lang, minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (lang === "fr") return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
};

export const withTravel = (minutes: number) => minutes + business.booking.travelMinutes;

/** Official French forms for the few towns whose names differ. */
const FR_TOWNS: Record<string, string> = { "Île Bizard": "L’Île-Bizard" };
/** Word joiners around the hyphens keep compound names whole on a line
 *  (the fonts have no non-breaking hyphen). */
export const nobreak = (s: string) => s.replace(/-/g, "\u2060-\u2060");
export const town = (lang: Lang, name: string) => nobreak(lang === "fr" ? FR_TOWNS[name] ?? name : name);
/** For attributes and metadata, where invisible characters don't belong. */
export const plain = (s: string) => s.replace(/\u2060/g, "");

/** Canonical and hreflang alternates for page metadata. */
export const alternates = (lang: Lang, path: string) => ({
  canonical: href(lang, path),
  languages: { "en-CA": href("en", path), "fr-CA": href("fr", path), "x-default": href("en", path) },
});
