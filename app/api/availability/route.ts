import { provider, earliest, pickServices } from "@/lib/booking/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?services=brakes,oil-change&days=31
 * Open arrival windows for a visit made of those services, back to back.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slugs = pickServices((url.searchParams.get("services") ?? url.searchParams.get("service") ?? "").split(","));
  if (!slugs) return json({ error: "unknown_service" }, 400);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 21, 1), 31);
  const p = provider();
  try {
    const from = earliest();
    const slots = (await p.availability(slugs, from, days)).filter((s) => new Date(s.startAt) >= from);
    return json({ live: p.live, provider: p.name, slots });
  } catch (e) {
    console.error("[availability]", e);
    return json({ error: "unavailable" }, 502);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
