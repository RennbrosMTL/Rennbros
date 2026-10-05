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
    /** Confirmed 2026-10-01: Rigaud to Dorval, down to Valleyfield, plus
     *  Dollard-des-Ormeaux, Les Cèdres and Pointe-des-Cascades. Île Bizard
     *  removed 2026-10-04 at the owner's request. */
    isPlaceholder: false,
    corners: { west: "Rigaud", north: "Pierrefonds", east: "Dorval", south: "Valleyfield" },
    towns: [
      "Baie-D'Urfé",
      "Beaconsfield",
      "Dorval",
      "Hudson",
      "Kirkland",
      "L'Île-Perrot",
      "Les Cèdres",
      "Notre-Dame-de-l'Île-Perrot",
      "Pierrefonds",
      "Pincourt",
      "Pointe-Claire",
      "Pointe-des-Cascades",
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
    homeHidden: ["Hudson", "Senneville", "Terrasse-Vaudreuil", "Les Cèdres", "Pointe-des-Cascades"],
  },

  hours: {
    /** 0 = Sunday. Saturday by arrangement. Confirmed 2026-10-01: 8 am to
     *  5 pm; 6 to 10 pm emergencies only (battery, jump start), by call or
     *  text, never booked online. */
    open: { days: [1, 2, 3, 4, 5], from: 8, to: 17 },
    byArrangement: [6],
  },

  booking: {
    /** Start times, on the hour, Montréal time (owners' rule 2026-10-05:
     *  any start, as long as the visit is finished by 5 pm). */
    arrivals: [8, 9, 10, 11, 12, 13, 14, 15, 16],
    /** Every visit must be finished by this hour; a start is offered only if
     *  the whole visit fits. Square's hours (business and team member) should
     *  be 8:00–17:00 to match. */
    finishBy: 17,
    /** Travel and prep kept free after every visit (not shown to customers). */
    bufferMinutes: 30,
    leadTimeHours: 24,
    /** Travel is in the buffer now; nothing is added to the time shown. */
    travelMinutes: 0,
    /** Percent of the estimate WITH taxes taken as a deposit when booking
     *  online (20 = 20%), owner's rule 2026-10-04. Refundable in full when
     *  cancelled at least 24 h before the visit. null turns the deposit off. */
    depositPercent: 20 as number | null,
    /** DRAFT — proposed in the booking terms (lib/i18n pages.terms), for the
     *  owner to confirm. */
    cancellationHours: 24 as number | null,
  },

  /** Québec sales taxes on the estimate: GST 5% + QST 9.975%. */
  tax: { gst: 0.05, qst: 0.09975 },

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
