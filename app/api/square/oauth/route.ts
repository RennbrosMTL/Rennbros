import { connect } from "@/lib/booking/squareAuth";

export const dynamic = "force-dynamic";

/** GET /api/square/oauth — Square sends the owner back here after approving. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookie = request.headers.get("cookie") ?? "";
  const expected = /(?:^|;\s*)sq_state=([\w-]+)/.exec(cookie)?.[1];
  const page = (title: string, body: string, status = 200) =>
    new Response(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
        `<body style="font:16px/1.5 system-ui,sans-serif;max-width:34rem;margin:12vh auto;padding:0 1rem;color:#1f2227">` +
        `<h1 style="font-size:1.4rem">${title}</h1><p>${body}</p><p><a href="/" style="color:#a8121a">Back to the site</a></p>`,
      { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "set-cookie": "sq_state=; Path=/api/square; Max-Age=0" } },
    );

  const code = url.searchParams.get("code");
  if (url.searchParams.get("error")) return page("Not connected", "Square approval was cancelled. Nothing changed.", 400);
  if (!code || !expected || url.searchParams.get("state") !== expected) return page("Not connected", "This link expired. Open /api/square/connect again.", 400);
  try {
    const r = await connect(code, `${url.origin}/api/square/oauth`);
    if (!r.ok) return page("Not connected", `${r.reason}. Nothing changed.`, 403);
    return page("Connected", "Website bookings now arrive in Square as requests. Square will notify you, and you accept or decline each one in the Square app. The customer gets Square's confirmation when you accept.");
  } catch (e) {
    console.error("[square-auth] connect failed", e);
    return page("Not connected", "Square didn't accept the request. Check the redirect URL and app secret, then try again.", 502);
  }
}
