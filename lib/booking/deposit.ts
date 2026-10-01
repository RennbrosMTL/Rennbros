/**
 * The deposit, one rule for the page and the server (the server never takes
 * an amount from the browser; it recomputes it from the services).
 *
 *   deposit = percent x the pre-tax estimate shown at booking
 *
 * The estimate is the "from" price the customer sees: the low end of a range,
 * one hour for hourly work, the chosen rim size for a tire change. So the
 * deposit can't exceed the percent of the final bill. Several services: one
 * deposit on the combined estimate. Rounded to the cent. Tax is settled on
 * the final invoice, not on the deposit.
 */
import { bySlug, mountPrice, type Rim } from "@/lib/services";

export function estimateOf(slugs: string[], rim?: Rim, runFlat = false): number {
  return slugs.reduce((sum, slug) => sum + (slug === "tire-install" ? mountPrice(rim, runFlat) : bySlug(slug)?.priceFrom ?? 0), 0);
}

/** percent is a whole number (20 = 20%); dollars x percent = cents. */
export function depositCents(slugs: string[], percent: number | null, rim?: Rim, runFlat = false): number {
  if (!percent || percent <= 0) return 0;
  return Math.round(estimateOf(slugs, rim, runFlat) * percent);
}
