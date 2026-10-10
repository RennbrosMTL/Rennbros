/**
 * A small per-visitor rate limit for the public endpoints (photo uploads,
 * booking requests), kept in Netlify Blobs: one counter per IP per hour.
 *
 * It's a brake on bots and floods, not an exact meter: two requests landing
 * at the same instant may both pass. If Blobs isn't reachable (local preview),
 * requests are allowed rather than blocked.
 */
export async function overLimit(request: Request, bucket: string, perHour: number): Promise<boolean> {
  const ip =
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const key = `${bucket}/${hour}/${ip.replace(/[^\w.:-]/g, "_")}`;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "rate-limit", consistency: "strong" });
    const n = Number((await store.get(key)) ?? 0) + 1;
    await store.set(key, String(n));
    // Now and then, clear counters from earlier hours.
    if (Math.random() < 0.02) {
      const { blobs } = await store.list({ prefix: `${bucket}/` });
      await Promise.all(blobs.filter((b) => !b.key.startsWith(`${bucket}/${hour}/`)).map((b) => store.delete(b.key)));
    }
    return n > perHour;
  } catch {
    return false;
  }
}
