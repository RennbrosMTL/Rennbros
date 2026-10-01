/**
 * The services — numbers and the pictures that illustrate each. Names and
 * descriptions live in lib/i18n under the same slugs.
 *
 * Prices are Renn Bros' own price list (RennBros Price List.pdf, received
 * 2026-09-29), shown the way the list shows them. `priceFrom` is the lowest
 * figure, used for the visit estimate and the deposit.
 */
export type Rim = "15-16" | "17-18" | "19-20" | "21+";

export type Pricing =
  /** "$125/h + parts" */
  | { kind: "hourly"; rate: number }
  /** "$125 per call" — the price is the price. */
  | { kind: "call"; amount: number }
  /** "$150–$220 + refrigerant" */
  | { kind: "range"; min: number; max: number; per?: "vehicle" | "inspection"; plus?: "refrigerant" | "sensors" }
  /** Mount and balance: a set of four, by rim size. */
  | { kind: "tiers"; tiers: { rim: Rim; price: number }[]; runFlat: number };

export type Service = {
  slug: string;
  pricing: Pricing;
  /** The lowest figure the pricing allows: estimates and the deposit start here. */
  priceFrom: number;
  /** The price is the price, not a floor. */
  exact?: boolean;
  /** On-site minutes, before travel. */
  minutes: number;
  /** The product still for this service, in public/media (menu pages, product pages). */
  image: string;
  /** The on-site photograph, in public/media/life (the home page menu). */
  photo: { name: string; width: number; height: number };
};

/** Mount and dynamic balance, set of four (price list, "Off-Rim"). */
export const MOUNT: Extract<Pricing, { kind: "tiers" }> = {
  kind: "tiers",
  tiers: [
    { rim: "15-16", price: 100 },
    { rim: "17-18", price: 120 },
    { rim: "19-20", price: 140 },
    { rim: "21+", price: 160 },
  ],
  runFlat: 20,
};

export const services: Service[] = [
  { slug: "oil-change", pricing: { kind: "hourly", rate: 125 }, priceFrom: 125, minutes: 60, image: "d-oil", photo: { name: "p05-oil", width: 1600, height: 1066 } },
  // The two tyre services follow Costco's split: are the other tyres already on their own rims?
  { slug: "tires", pricing: { kind: "range", min: 80, max: 100, per: "vehicle" }, priceFrom: 80, minutes: 60, image: "d-tires", photo: { name: "p06-winter", width: 1517, height: 1011 } },
  { slug: "tire-install", pricing: MOUNT, priceFrom: 100, minutes: 90, image: "d-install", photo: { name: "p04-mat", width: 1600, height: 1066 } },
  { slug: "tpms", pricing: { kind: "range", min: 40, max: 80, plus: "sensors" }, priceFrom: 40, minutes: 30, image: "d-tpms", photo: { name: "p15-tpms", width: 1600, height: 1073 } },
  { slug: "brakes", pricing: { kind: "hourly", rate: 125 }, priceFrom: 125, minutes: 120, image: "d-brakes", photo: { name: "p07-brakes", width: 1600, height: 1986 } },
  { slug: "battery", pricing: { kind: "hourly", rate: 125 }, priceFrom: 125, minutes: 45, image: "d-battery", photo: { name: "p08-battery", width: 1600, height: 1073 } },
  { slug: "diagnostics", pricing: { kind: "call", amount: 125 }, priceFrom: 125, exact: true, minutes: 60, image: "d-diag", photo: { name: "p09-diagnostic", width: 1517, height: 1011 } },
  { slug: "ppi", pricing: { kind: "range", min: 180, max: 250, per: "inspection" }, priceFrom: 180, minutes: 90, image: "d-ppi", photo: { name: "p16-ppi", width: 1600, height: 1073 } },
  { slug: "ac-diagnostic", pricing: { kind: "range", min: 150, max: 220, plus: "refrigerant" }, priceFrom: 150, minutes: 75, image: "d-ac", photo: { name: "p12-ac", width: 1600, height: 1067 } },
];

export const bySlug = (slug: string) => services.find((s) => s.slug === slug);

/** The two tyre services are either/or: a car needs one or the other. */
export const TIRE_CHOICES = ["tires", "tire-install"] as const;

export const isRim = (v: unknown): v is Rim => MOUNT.tiers.some((t) => t.rim === v);

/** What the mount-and-balance service costs for this rim size (set of four). */
export const mountPrice = (rim: Rim | undefined, runFlat: boolean) =>
  (MOUNT.tiers.find((t) => t.rim === rim)?.price ?? MOUNT.tiers[0].price) + (runFlat ? MOUNT.runFlat : 0);
