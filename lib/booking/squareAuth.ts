/**
 * A customer-level ("buyer-level") Square token, used only to create bookings.
 *
 * Why: bookings created with the owner's own access token count as the owner
 * booking himself, so Square accepts them at once and sends him no alert.
 * Created with buyer-level permissions, the same booking follows the
 * account's "accept bookings manually" setting: it arrives as PENDING, Square
 * notifies the owner, and he accepts or declines it in the Square app; the
 * customer's confirmation email goes out when he accepts.
 *
 * Getting the token, once (see README "Booking approval"):
 *   1. Netlify env: SQUARE_APP_SECRET = the app's production Application secret.
 *   2. Square Developer > the app > OAuth > Redirect URL:
 *      https://<site>/api/square/oauth
 *   3. The owner opens https://<site>/api/square/connect, signs in to Square
 *      and approves. The token is kept in Netlify Blobs (never in code or
 *      chat) and refreshed here before it expires.
 *
 * Only the Renn Bros Square account can be connected: the callback compares
 * the approving account with the one behind SQUARE_ACCESS_TOKEN.
 */

/** Buyer-level booking writes, plus the reads the free Appointments plan needs.
 *  Deliberately NOT APPOINTMENTS_ALL_WRITE: that would make bookings seller-level again. */
export const BUYER_SCOPES = [
  "APPOINTMENTS_READ",
  "APPOINTMENTS_WRITE",
  "APPOINTMENTS_BUSINESS_SETTINGS_READ",
  "APPOINTMENTS_ALL_READ",
  "CUSTOMERS_READ",
  "CUSTOMERS_WRITE",
  "ITEMS_READ",
  "MERCHANT_PROFILE_READ",
];

type Saved = { access_token: string; refresh_token: string; expires_at: string; merchant_id: string };

const env = process.env;
export const squareBase = () =>
  env.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
const appId = () => env.NEXT_PUBLIC_SQUARE_APP_ID ?? "";

async function store() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "square-auth", consistency: "strong" });
}

async function tokenRequest(body: Record<string, string>): Promise<Saved> {
  const res = await fetch(`${squareBase()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": "2026-09-16" },
    body: JSON.stringify({ client_id: appId(), client_secret: env.SQUARE_APP_SECRET, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<Saved> & { errors?: unknown };
  if (!res.ok || !json.access_token) throw new Error(`Square OAuth ${res.status}: ${JSON.stringify(json.errors ?? json)}`);
  return json as Saved;
}

/** The authorize link the owner opens once. */
export function authorizeUrl(state: string, redirectUri: string): string {
  const q = new URLSearchParams({ client_id: appId(), scope: BUYER_SCOPES.join(" "), session: "false", state, redirect_uri: redirectUri });
  return `${squareBase()}/oauth2/authorize?${q}`;
}

/** The merchant behind the owner's own access token. */
async function ownMerchant(): Promise<string | undefined> {
  const res = await fetch(`${squareBase()}/v2/merchants/me`, {
    headers: { Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`, "Square-Version": "2026-09-16" },
  });
  const json = (await res.json().catch(() => ({}))) as { merchant?: { id: string } };
  return json.merchant?.id;
}

/** Callback: trade the code for a token, but only for the Renn Bros account. */
export async function connect(code: string, redirectUri: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!env.SQUARE_APP_SECRET) return { ok: false, reason: "SQUARE_APP_SECRET is not set" };
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  const mine = await ownMerchant();
  if (!mine || t.merchant_id !== mine) return { ok: false, reason: "That Square account isn't the Renn Bros account" };
  await (await store()).setJSON("buyer", { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, merchant_id: t.merchant_id });
  return { ok: true };
}

/** Is the booking token in place, and until when (no secrets). */
export async function status(): Promise<{ connected: boolean; expiresAt?: string }> {
  try {
    const s = (await (await store()).get("buyer", { type: "json" })) as Saved | null;
    return s ? { connected: true, expiresAt: s.expires_at } : { connected: false };
  } catch {
    return { connected: false };
  }
}

/** The token for creating bookings, refreshed when it has under 7 days left.
 *  undefined (and the caller books as the owner) if none is set up. */
export async function bookingToken(): Promise<string | undefined> {
  if (!env.SQUARE_APP_SECRET) return undefined;
  const s = await store();
  const saved = (await s.get("buyer", { type: "json" })) as Saved | null;
  if (!saved) return undefined;
  if (Date.parse(saved.expires_at) - Date.now() > 7 * 86400_000) return saved.access_token;
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: saved.refresh_token });
    const next = { ...saved, access_token: t.access_token, expires_at: t.expires_at, refresh_token: t.refresh_token ?? saved.refresh_token };
    await s.setJSON("buyer", next);
    return next.access_token;
  } catch (e) {
    console.error("[square-auth] refresh failed; using the saved token while it lasts", e);
    return Date.parse(saved.expires_at) > Date.now() ? saved.access_token : undefined;
  }
}
