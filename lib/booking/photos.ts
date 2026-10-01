/**
 * Photos customers attach to a booking (a warning light, the problem, the VIN
 * sticker), kept in Netlify Blobs. Each id is the upload month (YYYYMM) plus
 * 104 random bits; the booking note links to /api/photo/<id>, which only that
 * link can reach. Photos older than 12 months are deleted (privacy policy).
 */
export const PHOTO_ID = /^[a-f0-9]{32}$/;
export const MAX_PHOTOS = 4;
/** After the browser shrinks it (1600 px, JPEG): a phone photo lands near 300 KB. */
export const MAX_BYTES = 2_500_000;

export function newPhotoId(now = new Date()): string {
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const rand = [...crypto.getRandomValues(new Uint8Array(13))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return month + rand;
}

/** Delete photos uploaded 12+ months ago (their id starts with the month). */
export async function prunePhotos(store: Awaited<ReturnType<typeof photoStore>>, now = new Date()) {
  const cutoff = Number(`${now.getUTCFullYear() - 1}${String(now.getUTCMonth() + 1).padStart(2, "0")}`);
  const { blobs } = await store.list();
  await Promise.all(blobs.filter((b) => /^\d{6}/.test(b.key) && Number(b.key.slice(0, 6)) <= cutoff).map((b) => store.delete(b.key)));
}

export async function photoStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "booking-photos", consistency: "strong" });
}

/** JPEG, PNG or WebP by their first bytes, whatever the request claims. */
export function imageType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
