import { authorizeUrl, status } from "@/lib/booking/squareAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/square/connect — the owner opens this once to approve booking
 * requests through Square (lib/booking/squareAuth.ts).
 * GET /api/square/connect?status — whether it's connected (no secrets).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has("status")) {
    return new Response(JSON.stringify(await status()), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  if (!process.env.SQUARE_APP_SECRET || !process.env.NEXT_PUBLIC_SQUARE_APP_ID) {
    return new Response("Booking approval isn't set up yet: SQUARE_APP_SECRET is missing in Netlify.", { status: 503 });
  }
  const state = crypto.randomUUID();
  const redirect = `${url.origin}/api/square/oauth`;
  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl(state, redirect),
      "set-cookie": `sq_state=${state}; Path=/api/square; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "cache-control": "no-store",
    },
  });
}
