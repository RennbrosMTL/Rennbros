import { provider, earliest, timing, schedule, pickServices } from "@/lib/booking/config";
import { toSquareAddress } from "@/lib/booking/address";
import { depositCents, estimateOf, estimateWithTax } from "@/lib/booking/deposit";
import { checkout, DepositDeclined } from "@/lib/booking/checkout";
import { MAX_PHOTOS, PHOTO_ID } from "@/lib/booking/photos";
import { isRim } from "@/lib/services";
import { overLimit } from "@/lib/ratelimit";
import { business } from "@/lib/business";
import { dict, href, type Lang } from "@/lib/i18n";
import { TIME_ZONE, SquareError, fits, type Slot, type Segment } from "@/lib/booking/square";

export const dynamic = "force-dynamic";

/**
 * POST /api/book — the booking request, for one service or several.
 *
 * Accepts the enhanced form (JSON, answers JSON) and the plain form posted
 * with no JavaScript (form data, answers with a 303 to the confirmation page,
 * or back to /book with #send-error, which the page reveals with CSS alone).
 *
 * Order matters (lib/booking/checkout.ts): validate, hold the deposit on the
 * card, create the booking, then capture. A failed booking releases the hold,
 * so a card is never charged for a booking that doesn't exist.
 */
export async function POST(request: Request) {
  const isJSON = (request.headers.get("content-type") ?? "").includes("application/json");

  // Same-origin only: another site must not be able to post bookings here.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host && new URL(origin).host !== request.headers.get("host")) {
    return new Response("Forbidden", { status: 403 });
  }
  // A brake on bots: a real customer sends one or two requests an hour.
  if (await overLimit(request, "book", 10)) return fail(request, "en", "rate_limited", 429, isJSON);

  let data: Record<string, unknown>;
  let serviceList: string[] = [];
  try {
    if (isJSON) {
      data = await request.json();
      const v = data.services ?? data.service;
      serviceList = Array.isArray(v) ? v.map(String) : String(v ?? "").split(",");
    } else {
      const form = await request.formData();
      data = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
      serviceList = form.getAll("service").map(String);
    }
  } catch {
    return fail(request, "en", "bad_request", 400, isJSON);
  }
  const lang: Lang = data.lang === "fr" ? "fr" : "en";
  const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "").trim();

  // --- validate ------------------------------------------------------------
  const slugs = pickServices(serviceList);
  const missing = ["address", "postal", "parking", "name", "phone", "email", "make", "model"].filter((k) => !s(k));
  if (!slugs || missing.length) return fail(request, lang, "missing_fields", 400, isJSON, { missing });
  if (!/^\S+@\S+\.\S+$/.test(s("email"))) return fail(request, lang, "email", 400, isJSON);
  // Office or business lot: only with the customer's consent to the disclosure
  // (they have, or will get, the property's permission).
  const office = (["en", "fr"] as const).some((l) => dict(l).book.where.parkingOptions.at(-1) === s("parking"));
  if (office && !s("parkingConsent").startsWith("accepted")) return fail(request, lang, "parking_consent", 400, isJSON);
  // The booking terms are accepted before any payment (Consumer Protection Act, s. 54.5).
  const termsAccepted = data.acceptTerms === true || data.acceptTerms === "on" || data.acceptTerms === "true";
  if (!termsAccepted) return fail(request, lang, "terms", 400, isJSON);
  const minutes = timing.total(slugs);

  let slot: Slot | null = null;
  if (s("startAt")) {
    let segments: Segment[] | undefined;
    try {
      const raw = data.segments;
      segments = typeof raw === "string" && raw ? JSON.parse(raw) : Array.isArray(raw) ? (raw as Segment[]) : undefined;
    } catch {
      segments = undefined;
    }
    slot = { startAt: s("startAt"), minutes, segments };
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(s("date")) && schedule.arrivals.includes(Number(s("window")))) {
    slot = { startAt: wallClock(s("date"), Number(s("window"))), minutes };
  }
  if (!slot || Number.isNaN(Date.parse(slot.startAt))) return fail(request, lang, "slot", 400, isJSON);
  if (new Date(slot.startAt) < earliest()) return fail(request, lang, "lead_time", 400, isJSON);
  if (!fits(schedule, slot.startAt, minutes)) return fail(request, lang, "too_long", 400, isJSON);

  // --- book ---------------------------------------------------------------
  const p = provider();
  const [givenName, ...rest] = s("name").split(/\s+/);
  const rimRaw = s("rim");
  const rim = isRim(rimRaw) ? rimRaw : undefined;
  const runFlat = !!s("runflat");
  // Photos uploaded with the form: only well-formed ids, at most four.
  const site = new URL(request.url).origin;
  const photoLinks = s("photos").split(",").filter((id) => PHOTO_ID.test(id)).slice(0, MAX_PHOTOS).map((id) => `${site}/api/photo/${id}`);
  // How the customer wants updates: Square notifies by whatever contact
  // details sit on the customer profile, so only those go on it.
  const flag = (k: string) => data[k] === true || data[k] === "on" || data[k] === "true";
  let notify = { email: flag("notifyEmail"), text: flag("notifyText") };
  if (!("notifyEmail" in data) && !("notifyText" in data)) notify = { email: true, text: true };
  if (!notify.email && !notify.text) return fail(request, lang, "notify", 400, isJSON);
  const note = [
    `Services: ${slugs.join(", ")} (about ${minutes} min with travel)`,
    slugs.includes("tire-install") && `Tires to mount and balance: rim ${rim ? `${rim}"` : "size not given"}${runFlat ? ", run-flat (+$20)" : ""}`,
    `Address: ${[s("address"), s("postal").toUpperCase()].filter(Boolean).join(", ")}`,
    `Parking: ${s("parking")}`,
    office && `Office/business lot: customer confirmed they have, or will get, the property's permission (consent and disclosure ${s("parkingConsent").slice(9) || "accepted"}).`,
    `Contact: ${s("phone")} · ${s("email")}`,
    `Accepted booking terms v1.0 and warranty (${lang === "fr" ? "French" : "English"} version) at ${new Date().toISOString()}`,
    `Updates by: ${notify.email && notify.text ? "email and text" : notify.email ? "email only (no texts)" : "text only (no emails)"}`,
    `Vehicle: ${[s("year"), s("make"), s("model")].filter(Boolean).join(" ")}`,
    s("vin") && `VIN: ${s("vin")}`,
    lang === "fr" && "Language: French — reply in French",
    s("notes") && `Notes: ${s("notes")}`,
    photoLinks.length > 0 && `Photos:\n${photoLinks.join("\n")}`,
  ].filter(Boolean).join("\n");

  // The deposit: recomputed here from the services, never taken from the browser.
  const pct = business.booking.depositPercent;
  // Preview mode (no Square keys) books nothing real, so it takes no deposit.
  const amountCents = p.live ? depositCents(slugs, pct, rim, runFlat) : 0;
  if (amountCents > 0 && !s("sourceId")) return fail(request, lang, "card_required", 400, isJSON);
  // One id per booking attempt; a resend of the same attempt can't charge or book twice.
  const attempt = /^[\w-]{8,64}$/.test(s("attempt")) ? s("attempt") : crypto.randomUUID();
  const estimate = estimateOf(slugs, rim, runFlat);

  try {
    const { booking, deposit: dep } = await checkout(
      p,
      attempt,
      {
        slugs,
        slot,
        customer: { givenName, familyName: rest.join(" ") || undefined, email: s("email"), phone: s("phone"), notify },
        address: s("address"),
        place: toSquareAddress(s("address"), s("postal")),
        note: amountCents > 0 ? `${note}\nEstimate before tax: $${estimate.toFixed(2)} · with GST and QST: $${estimateWithTax(slugs, rim, runFlat).toFixed(2)} · deposit ${pct}% of that` : note,
        lang,
      },
      amountCents > 0
        ? {
            amountCents,
            sourceId: s("sourceId"),
            verificationToken: s("verificationToken") || undefined,
            buyerEmail: s("email"),
            note: `Deposit ${pct}% · ${slugs.join(", ")} · ${s("name")} · ${slot.startAt.slice(0, 10)}`,
          }
        : null,
    );
    const deposit = dep && { status: dep.captured ? "COMPLETED" : "NOT_CAPTURED", cents: dep.payment.amountCents || amountCents };

    if (!p.live) console.info(`[book] stand-in booking ${booking.id}\n${note}`);
    if (isJSON) return json({ ok: true, ref: booking.id, status: booking.status, live: p.live, deposit: deposit?.status, depositCents: deposit?.cents });
    return Response.redirect(new URL(`${href(lang, "/book/received")}?ref=${encodeURIComponent(booking.id)}`, request.url), 303);
  } catch (e) {
    const taken = e instanceof SquareError && e.status === 409;
    console.error("[book]", e instanceof SquareError ? JSON.stringify(e.detail) : e);
    if (e instanceof DepositDeclined) {
      console.warn("[book] deposit declined", JSON.stringify(e.detail));
      return fail(request, lang, "card_declined", 402, isJSON);
    }
    return fail(request, lang, taken ? "taken" : "provider", taken ? 409 : 502, isJSON);
  }
}

/** A wall-clock hour on a Montréal date, as UTC ISO. */
function wallClock(ymd: string, hour: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  const off = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(t)).map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  let t = wall - off(wall);
  t = wall - off(t);
  return new Date(t).toISOString();
}

function fail(request: Request, lang: Lang, error: string, status: number, isJSON: boolean, extra: object = {}) {
  if (isJSON) return json({ ok: false, error, ...extra }, status);
  return Response.redirect(new URL(`${href(lang, "/book")}?error=${error}#send-error`, request.url), 303);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
