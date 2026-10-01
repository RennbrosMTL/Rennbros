/**
 * Renn Bros — business facts. Numbers and proper nouns only; every sentence
 * lives in the dictionaries (src/i18n). One edit per fact.
 *
 * Source: Onboarding/Matt_Mobile_Mechanic_Website_Questionnaire_filled.docx
 */

export const business = {
  name: "Renn Bros",
  tagline: "Pneu et Mécanique",

  /** Confirmed by Tashii, 2026-09-27. */
  phone: { display: "(514) 891-7366", tel: "+15148917366", isPlaceholder: false },

  email: "info@RennBros.com",
  domain: "RennBros.com",

  area: {
    /** PENDING CONFIRMATION. The questionnaire says, verbatim: "Dorval to the
     *  east, Ile bizarre to the north, vallefield south and rigaud West".
     *  A narrower list has been mentioned since; confirm with the client. */
    isPlaceholder: true,
    corners: { west: "Rigaud", north: "Île Bizard", east: "Dorval", south: "Valleyfield" },
    towns: [
      "Baie-D'Urfé",
      "Beaconsfield",
      "Dorval",
      "Hudson",
      "Île Bizard",
      "Kirkland",
      "L'Île-Perrot",
      "Notre-Dame-de-l'Île-Perrot",
      "Pierrefonds",
      "Pincourt",
      "Pointe-Claire",
      "Rigaud",
      "Saint-Lazare",
      "Sainte-Anne-de-Bellevue",
      "Senneville",
      "Terrasse-Vaudreuil",
      "Valleyfield",
      "Vaudreuil-Dorion",
    ],
    /** Left off the home page's town buttons to keep that block compact
     *  (still on the map, and listed in full on the service area page). */
    homeHidden: ["Hudson", "Senneville", "Terrasse-Vaudreuil"],
  },

  hours: {
    /** 0 = Sunday. Saturday by arrangement. Confirmed 2026-10-01: 8 am to
     *  5 pm; 6 to 10 pm emergencies only (battery, jump start), by call or
     *  text, never booked online. */
    open: { days: [1, 2, 3, 4, 5], from: 8, to: 17 },
    byArrangement: [6],
  },

  booking: {
    /** Arrival windows, three hours apart, Montréal time. */
    arrivals: [8, 11, 14],
    /** A visit, however many services, must be finished by this hour. */
    finishBy: 17,
    leadTimeHours: 24,
    travelMinutes: 30,
    /** UNSET — deposit percentage not confirmed. While null, no deposit is
     *  taken online and the page says the amount is set on confirmation. */
    depositPercent: null as number | null,
    /** DRAFT — proposed in the booking terms (lib/i18n pages.terms), for the
     *  owner to confirm. */
    cancellationHours: 24 as number | null,
  },

  warrantyMonths: 12,

  /** From the Renn Bros price list (2026-09-29): IG @rennbrosmtl, FB /rennbrosmtl, WhatsApp on the business number. */
  social: {
    isPlaceholder: false,
    links: [
      { name: "Instagram", icon: "instagram", href: "https://www.instagram.com/rennbrosmtl/" },
      { name: "Facebook", icon: "facebook", href: "https://www.facebook.com/rennbrosmtl" },
      { name: "WhatsApp", icon: "whatsapp", href: "https://wa.me/15148917366" },
    ],
  },
} as const;

/** A WhatsApp chat with the business number, optionally with a first line typed in. */
export function whatsappHref(hello?: string): string {
  const n = business.phone.tel.replace(/\D/g, "");
  return `https://wa.me/${n}${hello ? `?text=${encodeURIComponent(hello)}` : ""}`;
}
