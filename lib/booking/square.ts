/**
 * Renn Bros — booking core, shared by every concept.
 *
 * Framework-free: plain fetch against Square's REST API, no SDK, so the same
 * file runs behind an Astro endpoint, a Next route handler or a SvelteKit
 * +server.ts. Copy it into each site; each site wraps it in a thin endpoint.
 *
 * Two implementations behind one interface:
 *   - square()  : the real thing (sandbox or production), when keys are set;
 *   - standIn() : deterministic, clearly labelled, for design review and for
 *                 every environment without keys. Swapping is configuration.
 *
 * What Square allows on the FREE Appointments plan (verified against the
 * Bookings API docs, Sept 2026): an application can read availability and
 * create customer-level ("buyer-level") bookings. Seller-level writes need
 * Appointments Plus/Premium. Deposits are a separate Payments API call with a
 * card token from Square's own Web Payments SDK card field; no card data ever
 * touches the site. Availability ranges must be 24 hours to 32 days long.
 */

import type { SquareAddress } from "./address";

export const SQUARE_VERSION = "2026-09-16";
export const TIME_ZONE = "America/Toronto"; // Montréal's IANA zone

/** One service within a visit, as Square schedules it. */
export type Segment = {
  slug: string;
  minutes: number;
  teamMemberId?: string;
  serviceVariationVersion?: number;
};

export type Slot = {
  /** RFC 3339, UTC. */
  startAt: string;
  /** The whole visit: every service plus travel. */
  minutes: number;
  /** Square's per-service segments, passed back when booking; empty for the stand-in. */
  segments?: Segment[];
};

/** When visits may start and by when they must be finished (Montréal time). */
export type Schedule = {
  /** Arrival hours, e.g. [8, 11, 14]. */
  arrivals: number[];
  /** Weekdays that take bookings, 0 = Sunday. */
  days: number[];
  /** The hour by which a visit must be finished. */
  finishBy: number;
};

/** Minutes for a set of services: each service's time, plus travel once. */
export type Timing = { total(slugs: string[]): number; each(slug: string): number };

export type BookInput = {
  slugs: string[];
  slot: Slot;
  customer: { givenName: string; familyName?: string; email: string; phone: string };
  /** As typed, for the note. */
  address: string;
  /** Structured, for Square (null when we couldn't be sure of city or postal code). */
  place: SquareAddress | null;
  note: string;
  lang: "en" | "fr";
  /** Same key on a retry = the same booking back from Square. */
  idempotencyKey?: string;
};

export type BookResult = {
  id: string;
  /** PENDING = waiting for the owner to accept (the request model). DEMO = stand-in. */
  status: "PENDING" | "ACCEPTED" | "DEMO";
  customerId?: string;
};

/** A card hold for the deposit. Taken BEFORE the booking, captured after it. */
export type HoldInput = {
  sourceId: string;
  verificationToken?: string;
  amountCents: number;
  /** Same key on a retry = the same payment back from Square, never a second one. */
  idempotencyKey: string;
  buyerEmail?: string;
  note: string;
};

export type Payment = { id: string; status: string; amountCents: number };

export interface BookingProvider {
  readonly name: "square" | "stand-in";
  readonly live: boolean;
  availability(slugs: string[], from: Date, days: number): Promise<Slot[]>;
  book(input: BookInput): Promise<BookResult>;
  /** Authorize the deposit on the card (not charged yet). Square cancels the
   *  hold by itself after 30 minutes unless it is captured. */
  hold(input: HoldInput): Promise<Payment>;
  /** Turn a hold into a charge (after the booking exists). */
  capture(paymentId: string): Promise<Payment>;
  /** Drop a hold (the booking failed): the customer is never charged. */
  release(paymentId: string): Promise<void>;
}

export type SquareEnv = {
  accessToken?: string;
  environment?: "sandbox" | "production";
  locationId?: string;
  /** Optional: restrict availability to one team member. */
  teamMemberId?: string;
  /** Site service slug -> Square catalog service variation id. */
  serviceVariations: Record<string, string>;
};

/* ------------------------------------------------------------------------ */

export function bookingProvider(env: SquareEnv, timing: Timing, schedule: Schedule): BookingProvider {
  return env.accessToken && env.locationId && Object.keys(env.serviceVariations).length
    ? square(env, timing, schedule)
    : standIn(timing, schedule);
}

/** The Montréal wall-clock hour and minute of an instant. */
function localTime(iso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hourCycle: "h23", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { hour: Number(p.hour), minute: Number(p.minute) };
}

/** Does a visit of this length, starting then, fit the schedule? */
export function fits(schedule: Schedule, startAt: string, minutes: number) {
  const { hour, minute } = localTime(startAt);
  return minute === 0 && schedule.arrivals.includes(hour) && hour * 60 + minutes <= schedule.finishBy * 60;
}

/** Parse SQUARE_SERVICES='{"oil-change":"VARIATION_ID",...}' safely. */
export function parseServiceMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

type SquarePayment = { id: string; status: string; amount_money?: { amount: number } };
const asPayment = (p: SquarePayment): Payment => ({ id: p.id, status: p.status, amountCents: p.amount_money?.amount ?? 0 });

/* --- Square --------------------------------------------------------------- */

// Explicit fields, not constructor parameter properties: this file has to run
// under plain type-stripping (Node, Vite, Astro) as well as full tsc.
export class SquareError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(`Square ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

export function square(env: SquareEnv, timing: Timing, schedule: Schedule): BookingProvider {
  const base =
    env.environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";

  const call = async <T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
    const res = await fetch(base + path, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        Authorization: `Bearer ${env.accessToken}`,
        "Square-Version": SQUARE_VERSION,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new SquareError(res.status, (json as { errors?: unknown }).errors ?? json);
    return json as T;
  };

  const variation = (slug: string) => {
    const id = env.serviceVariations[slug];
    if (!id) throw new Error(`No Square service variation for "${slug}"`);
    return id;
  };

  // A booking needs the variation's current version; read it once per variation.
  const versions = new Map<string, number>();
  const versionOf = async (id: string) => {
    if (!versions.has(id)) {
      const r = await call<{ object: { version: number } }>(`/v2/catalog/object/${id}`);
      versions.set(id, r.object.version);
    }
    return versions.get(id)!;
  };

  const customerFor = async (c: BookInput["customer"]) => {
    const found = await call<{ customers?: { id: string }[] }>("/v2/customers/search", {
      body: { query: { filter: { email_address: { exact: c.email } } }, limit: 1 },
    });
    if (found.customers?.[0]) return found.customers[0].id;
    const made = await call<{ customer: { id: string } }>("/v2/customers", {
      body: {
        idempotency_key: uuid(),
        given_name: c.givenName,
        family_name: c.familyName,
        email_address: c.email,
        phone_number: c.phone,
      },
    });
    return made.customer.id;
  };

  return {
    name: "square",
    live: true,

    async availability(slugs, from, days) {
      const start = new Date(from);
      const end = new Date(start.getTime() + Math.min(Math.max(days, 1), 32) * 86400000);
      // One segment filter per service: Square finds times when the whole
      // sequence fits back to back.
      const r = await call<{
        availabilities?: {
          start_at: string;
          appointment_segments: {
            duration_minutes: number;
            team_member_id: string;
            service_variation_id: string;
            service_variation_version: number;
          }[];
        }[];
      }>("/v2/bookings/availability/search", {
        body: {
          query: {
            filter: {
              start_at_range: { start_at: start.toISOString(), end_at: end.toISOString() },
              location_id: env.locationId,
              segment_filters: slugs.map((slug) => ({
                service_variation_id: variation(slug),
                ...(env.teamMemberId ? { team_member_id_filter: { any: [env.teamMemberId] } } : {}),
              })),
            },
          },
        },
      });
      const bySlug = Object.fromEntries(Object.entries(env.serviceVariations).map(([k, v]) => [v, k]));
      const minutes = timing.total(slugs);
      // Square offers whatever its own settings allow; keep the site's windows.
      return (r.availabilities ?? [])
        .filter((a) => fits(schedule, a.start_at, minutes))
        .map((a) => ({
          startAt: a.start_at,
          minutes,
          segments: a.appointment_segments.map((s) => ({
            slug: bySlug[s.service_variation_id] ?? "",
            minutes: s.duration_minutes,
            teamMemberId: s.team_member_id,
            serviceVariationVersion: s.service_variation_version,
          })),
        }));
    },

    async book(input) {
      const customerId = await customerFor(input.customer);
      const given = input.slot.segments?.length === input.slugs.length ? input.slot.segments : null;
      const segments = await Promise.all(
        input.slugs.map(async (slug, i) => {
          const id = variation(slug);
          const teamMemberId = given?.[i]?.teamMemberId ?? env.teamMemberId;
          if (!teamMemberId) throw new Error("No team member for this slot");
          return {
            team_member_id: teamMemberId,
            service_variation_id: id,
            service_variation_version: given?.[i]?.serviceVariationVersion ?? (await versionOf(id)),
            duration_minutes: given?.[i]?.minutes ?? timing.each(slug),
          };
        }),
      );
      const key = input.idempotencyKey ?? uuid();
      const create = (where: object, retry = false) =>
        call<{ booking: { id: string; status: string } }>("/v2/bookings", {
          body: {
            idempotency_key: retry ? `${key}-n` : key,
            booking: {
              start_at: input.slot.startAt,
              location_id: env.locationId,
              customer_id: customerId,
              ...where,
              customer_note: input.note.slice(0, 4096),
              appointment_segments: segments,
            },
          },
        });
      // The work happens at the customer's address: send it as Square wants it
      // (street, city, province, postal code). If Square still refuses the
      // address, book anyway: the address is in the note, and no customer's
      // booking should fail over address formatting.
      let r: { booking: { id: string; status: string } };
      try {
        r = input.place ? await create({ location_type: "CUSTOMER_LOCATION", address: input.place }) : await create({});
      } catch (e) {
        if (!(input.place && e instanceof SquareError && e.status === 400 && JSON.stringify(e.detail).includes("address"))) throw e;
        console.warn("[book] Square refused the address; booking with the address in the note", JSON.stringify(e.detail));
        r = await create({}, true);
      }
      const status = r.booking.status === "ACCEPTED" ? "ACCEPTED" : "PENDING";
      return { id: r.booking.id, status, customerId };
    },

    async hold(input) {
      const r = await call<{ payment: SquarePayment }>("/v2/payments", {
        body: {
          source_id: input.sourceId,
          verification_token: input.verificationToken,
          idempotency_key: input.idempotencyKey,
          amount_money: { amount: input.amountCents, currency: "CAD" },
          location_id: env.locationId,
          reference_id: input.idempotencyKey.slice(0, 40),
          buyer_email_address: input.buyerEmail,
          note: input.note.slice(0, 500),
          // Authorize only. If anything goes wrong before we capture, Square
          // drops the hold by itself; the card is never charged.
          autocomplete: false,
          delay_duration: "PT30M",
          delay_action: "CANCEL",
        },
      });
      return asPayment(r.payment);
    },
    async capture(paymentId) {
      const r = await call<{ payment: SquarePayment }>(`/v2/payments/${encodeURIComponent(paymentId)}/complete`, { body: {} });
      return asPayment(r.payment);
    },
    async release(paymentId) {
      await call(`/v2/payments/${encodeURIComponent(paymentId)}/cancel`, { body: {} });
    },
  };
}

/* --- Stand-in ------------------------------------------------------------- */

/**
 * Deterministic availability that looks like a real diary: the schedule's
 * arrival windows on its working days, about a third of windows already
 * taken, seeded by date so a day always shows the same picture. A visit
 * longer than the gap to the next window needs that window free too, so a
 * long combined job never lands on top of another booking.
 */
export function standIn(timing: Timing, schedule: Schedule): BookingProvider {
  const taken = (key: string) => {
    let h = 2166136261;
    for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) % 100 < 30;
  };
  return {
    name: "stand-in",
    live: false,
    async availability(slugs, from, days) {
      const out: Slot[] = [];
      const minutes = timing.total(slugs);
      const day0 = new Date(from);
      for (let d = 0; d < Math.min(days, 32); d++) {
        const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(day0.getTime() + d * 86400000));
        const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
        if (!schedule.days.includes(dow)) continue;
        for (const h of schedule.arrivals) {
          if (h * 60 + minutes > schedule.finishBy * 60) continue;
          // Every window this visit reaches into must be free.
          const reaches = schedule.arrivals.filter((a) => a >= h && a * 60 < h * 60 + minutes);
          if (reaches.some((a) => taken(`${ymd}-${a}`))) continue;
          out.push({ startAt: zoned(ymd, h), minutes });
        }
      }
      return out.filter((s) => new Date(s.startAt) >= from);
    },
    async book() {
      return { id: `DEMO-${uuid().slice(0, 8).toUpperCase()}`, status: "DEMO" };
    },
    async hold(input) {
      return { id: `DEMO-PAY-${input.idempotencyKey.slice(0, 8)}`, status: "APPROVED", amountCents: input.amountCents };
    },
    async capture(paymentId) {
      return { id: paymentId, status: "COMPLETED", amountCents: 0 };
    },
    async release() {},
  };
}

/** The zone's offset from UTC at an instant, in ms (e.g. -4h during EDT). */
function offsetAt(instant: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((x) => [x.type, x.value]),
  );
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - instant;
}

/**
 * A wall-clock hour on a Montréal calendar date, as UTC ISO.
 * Independent of the server's own time zone, and correct across the EST/EDT
 * change (the offset is re-read at the resulting instant).
 */
function zoned(ymd: string, hour: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  let t = wall - offsetAt(wall);
  t = wall - offsetAt(t);
  return new Date(t).toISOString();
}
