/**
 * Which booking provider this deployment uses, from the environment.
 *
 *   SQUARE_ACCESS_TOKEN        server secret (sandbox or production token)
 *   SQUARE_ENVIRONMENT         "sandbox" (default) | "production"
 *   SQUARE_LOCATION_ID         the seller's location
 *   SQUARE_TEAM_MEMBER_ID      optional: only this person's calendar
 *   SQUARE_SERVICES            JSON map, site slug -> service variation id,
 *                              e.g. {"oil-change":"GXZ...","brakes":"7QK..."}
 *   NEXT_PUBLIC_SQUARE_APP_ID       for the card field (Web Payments SDK)
 *   NEXT_PUBLIC_SQUARE_LOCATION_ID  same location id, exposed to the card field
 *   NEXT_PUBLIC_SQUARE_ENVIRONMENT  "production" to load Square's live card field
 *   SQUARE_APP_SECRET          the app's OAuth secret: lets the site hold a
 *                              customer-level token so bookings arrive in
 *                              Square as requests (see squareAuth.ts)
 *
 * These live in Netlify: Site configuration > Environment variables. The
 * NEXT_PUBLIC_ ones are read at build time, so redeploy after changing them.
 *
 * With none set, the stand-in answers, and every page that shows its output
 * says so. Adding the keys is the only step between this and live bookings.
 */
import { bookingProvider, parseServiceMap } from "./square";
import { bySlug, services } from "@/lib/services";
import { business } from "@/lib/business";
import { bookingToken } from "./squareAuth";

const env = process.env;

/** Each service's own time, and a visit's total (the travel buffer is kept separately, in schedule). */
export const timing = {
  each: (slug: string) => bySlug(slug)?.minutes ?? 60,
  total: (slugs: string[]) => slugs.reduce((m, s) => m + (bySlug(s)?.minutes ?? 60), 0) + business.booking.travelMinutes,
};

export const schedule = {
  arrivals: [...business.booking.arrivals] as number[],
  days: [...business.hours.open.days] as number[],
  finishBy: business.booking.finishBy,
  buffer: business.booking.bufferMinutes,
};

export const provider = () =>
  bookingProvider(
    {
      accessToken: env.SQUARE_ACCESS_TOKEN,
      environment: env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox",
      locationId: env.SQUARE_LOCATION_ID,
      teamMemberId: env.SQUARE_TEAM_MEMBER_ID,
      serviceVariations: parseServiceMap(env.SQUARE_SERVICES),
      probeService: env.SQUARE_PROBE_SERVICE,
      bookingToken: env.SQUARE_APP_SECRET ? bookingToken : undefined,
    },
    timing,
    schedule,
  );

/** The first instant a visit may start: now plus the lead time. */
export const earliest = (now = Date.now()) => new Date(now + business.booking.leadTimeHours * 3600_000);

/** Known services from a list, deduplicated, in menu order; null if none or any unknown. */
export const pickServices = (raw: string[]): string[] | null => {
  const asked = raw.map((s) => s.trim()).filter(Boolean);
  if (!asked.length || asked.some((s) => !bySlug(s))) return null;
  return services.map((s) => s.slug).filter((s) => asked.includes(s));
};
