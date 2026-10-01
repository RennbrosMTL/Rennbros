import { business } from "@/lib/business";
import { dict, href, plain, servicesIn, type Lang } from "@/lib/i18n";
import type { Pricing } from "@/lib/services";

/** LocalBusiness data for search: no storefront, a list of towns served. */
export function StructuredData({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const site = `https://${business.domain.toLowerCase()}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    "@id": `${site}/#business`,
    name: business.name,
    alternateName: business.tagline,
    description: t.meta.homeDescription,
    url: site + href(lang, "/"),
    logo: `${site}/icon-512.png`,
    image: `${site}/og.jpg`,
    email: business.email,
    ...(business.phone.isPlaceholder ? {} : { telephone: business.phone.tel }),
    priceRange: "$$",
    areaServed: business.area.towns.map((name) => ({
      "@type": "City",
      name,
      address: { "@type": "PostalAddress", addressRegion: "QC", addressCountry: "CA" },
    })),
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "20:00" },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: t.nav.services,
      itemListElement: servicesIn(lang).map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.name, description: s.short, url: site + href(lang, `/services/${s.slug}`) },
        priceSpecification: spec(s.pricing),
      })),
    },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: plain(JSON.stringify(data)) }} />;
}

/** The price list, the way search engines read prices. */
function spec(p: Pricing) {
  const base = { "@type": "PriceSpecification", priceCurrency: "CAD" };
  switch (p.kind) {
    case "hourly":
      return { ...base, "@type": "UnitPriceSpecification", price: p.rate, unitCode: "HUR" };
    case "call":
      return { ...base, price: p.amount };
    case "range":
      return { ...base, minPrice: p.min, maxPrice: p.max };
    case "tiers":
      return { ...base, minPrice: p.tiers[0].price, maxPrice: p.tiers[p.tiers.length - 1].price };
  }
}
