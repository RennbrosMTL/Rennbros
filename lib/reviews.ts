/**
 * Customer reviews: genuine Google reviews only, read from the Renn Bros
 * Google Business Profile through the Places API and cached for a day.
 *
 * Nothing shows until both settings exist on Netlify and the profile has at
 * least one review:
 *   GOOGLE_PLACES_API_KEY  a Google Cloud key restricted to the Places API (New)
 *   GOOGLE_PLACE_ID        the profile's Place ID (starts with "ChIJ")
 *
 * Google returns up to five reviews per language, its own "most relevant"
 * selection; they are shown as given, with the author's name and Google's
 * attribution, and the overall rating and count are always shown with them.
 * Never add written or invented reviews here: published testimonials must be
 * real (Competition Act, Canada).
 */
import type { Lang } from "@/lib/i18n";

export type Review = { author: string; rating: number; text: string; when: string };
export type ReviewSummary = { rating: number; count: number; url: string; reviews: Review[] };

type PlacesReview = {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string };
};

export async function googleReviews(lang: Lang): Promise<ReviewSummary | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const id = process.env.GOOGLE_PLACE_ID;
  if (!key || !id) return null;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=${lang}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount,reviews,googleMapsUri" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error("[reviews] Places API", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const p = (await res.json()) as { rating?: number; userRatingCount?: number; googleMapsUri?: string; reviews?: PlacesReview[] };
    const reviews = (p.reviews ?? [])
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? "",
        rating: Math.round(r.rating ?? 0),
        // Published in the language it was written in.
        text: (r.originalText?.text ?? r.text?.text ?? "").trim(),
        when: r.relativePublishTimeDescription ?? "",
      }))
      .filter((r) => r.author && r.text);
    if (!reviews.length || !p.rating) return null;
    return { rating: p.rating, count: p.userRatingCount ?? reviews.length, url: p.googleMapsUri ?? "", reviews };
  } catch (e) {
    console.error("[reviews]", e);
    return null;
  }
}
