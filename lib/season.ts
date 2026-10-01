/**
 * Which hero the site shows, by the date in Montréal. The pages that use it
 * re-render hourly (revalidate), so the hero changes on its own on the first
 * day of each season; no redeploy needed.
 *
 *   winter  November 1 to end of February   snow on the driveway and the tires
 *   spring  March 1 to end of May           blossom, silver alloys
 *   summer  June 1 to end of August         evening sun, silver alloys
 *   fall    September 1 to end of October   sundown, maple leaves drifting
 *
 * Each lives in public/media/seasons/<name>/ as loop.mp4, poster.jpg, still.jpg.
 * To pin one season (a shoot, a campaign), set HERO_SEASON_OVERRIDE on Netlify.
 */
export type HeroSeason = "winter" | "spring" | "summer" | "fall";

const SEASONS: HeroSeason[] = ["winter", "spring", "summer", "fall"];

/** First month of each season (1 = January). Change the dates here. */
export const SEASON_STARTS: [month: number, season: HeroSeason][] = [
  [3, "spring"],
  [6, "summer"],
  [9, "fall"],
  [11, "winter"],
];

/** The season on a given day, Montréal time. */
export function seasonOn(date: Date = new Date()): HeroSeason {
  const forced = process.env.HERO_SEASON_OVERRIDE as HeroSeason | undefined;
  if (forced && SEASONS.includes(forced)) return forced;
  const month = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "numeric" }).format(date));
  let season: HeroSeason = SEASON_STARTS[SEASON_STARTS.length - 1][1];
  for (const [m, s] of SEASON_STARTS) if (month >= m) season = s;
  return season;
}

export type HeroMedia = { season: HeroSeason; loop: string; poster: string; still: string; alt: `d-hero-${HeroSeason}` };

export function heroMediaFor(season: HeroSeason = seasonOn()): HeroMedia {
  const dir = `/media/seasons/${season}`;
  return { season, loop: `${dir}/loop.mp4`, poster: `${dir}/poster.jpg`, still: `${dir}/still.jpg`, alt: `d-hero-${season}` };
}
