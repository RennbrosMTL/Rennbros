import { PHOTO_ID, photoStore } from "@/lib/booking/photos";

/** A booking photo, for the link in the booking note. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID.test(id)) return new Response("Not found", { status: 404 });
  try {
    const store = await photoStore();
    const hit = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!hit) return new Response("Not found", { status: 404 });
    return new Response(hit.data, {
      headers: {
        "content-type": String(hit.metadata?.type ?? "image/jpeg"),
        "cache-control": "private, max-age=86400",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch (e) {
    console.error("[photo]", e);
    return new Response("Unavailable", { status: 503 });
  }
}
