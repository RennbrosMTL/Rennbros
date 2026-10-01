/**
 * Which hero this build shows. Set NEXT_PUBLIC_HERO_SEASON at build time:
 *   fall   (default) sundown, maple leaves drifting, an unbranded SUV (sharp) behind
 *   winter           golden hour, snow falling (kept for November to January)
 * Both live in public/media/seasons/<name>/ as loop.mp4, poster.jpg, still.jpg.
 */
export type HeroSeason = "fall" | "winter";

export const heroSeason: HeroSeason = process.env.NEXT_PUBLIC_HERO_SEASON === "winter" ? "winter" : "fall";

export const heroMedia = {
  loop: `/media/seasons/${heroSeason}/loop.mp4`,
  poster: `/media/seasons/${heroSeason}/poster.jpg`,
  still: `/media/seasons/${heroSeason}/still.jpg`,
  /** The key in the dictionaries' images for this season's description. */
  alt: heroSeason === "winter" ? "d-hero" : "d-hero-fall",
} as const;
