import { MAX_BYTES, imageType, newPhotoId, photoStore, prunePhotos } from "@/lib/booking/photos";

/** Upload one booking photo (the raw image as the body). Answers { id }. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host && new URL(origin).host !== request.headers.get("host")) {
    return new Response("Forbidden", { status: 403 });
  }
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return json({ ok: false, error: "too_big" }, 413);
  const body = new Uint8Array(await request.arrayBuffer());
  if (!body.length || body.length > MAX_BYTES) return json({ ok: false, error: "too_big" }, 413);
  const type = imageType(body);
  if (!type) return json({ ok: false, error: "not_image" }, 415);

  const id = newPhotoId();
  try {
    const store = await photoStore();
    await store.set(id, body.buffer as ArrayBuffer, { metadata: { type, at: new Date().toISOString() } });
    // Now and then (about 1 upload in 20), clear out photos past 12 months.
    if (Math.random() < 0.05) await prunePhotos(store).catch((e) => console.error("[photo] prune", e));
  } catch (e) {
    // Not on Netlify (local preview) or Blobs unavailable: the booking still works without photos.
    console.error("[photo]", e);
    return json({ ok: false, error: "storage" }, 503);
  }
  return json({ ok: true, id });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
