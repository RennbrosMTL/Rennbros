import type { MetadataRoute } from "next";
import { business } from "@/lib/business";
import { services } from "@/lib/services";
import { href } from "@/lib/i18n";

/** Every public page in both languages, each listing its counterpart. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = `https://${business.domain.toLowerCase()}`;
  const paths = ["/", "/services", ...services.map((s) => `/services/${s.slug}`), "/how-it-works", "/area", "/faq", "/book", "/legal/privacy", "/legal/warranty", "/legal/terms"];
  return paths.flatMap((p) =>
    (["en", "fr"] as const).map((lang) => ({
      url: site + href(lang, p),
      alternates: { languages: { "en-CA": site + href("en", p), "fr-CA": site + href("fr", p) } },
    })),
  );
}
