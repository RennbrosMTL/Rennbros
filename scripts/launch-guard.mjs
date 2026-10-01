/**
 * The launch guard. Run before the site goes public on RennBros.com:
 *
 *   npm run launch-check
 *
 * Every item below is something only the client can supply. Each is flagged
 * in code; this reads the flags so they are checked rather than remembered.
 * BLOCK items fail the check. NOTE items are decisions the site handles
 * gracefully while unset, listed so they are made on purpose.
 */
import { readFile } from "node:fs/promises";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");
const business = await read("lib/business.ts");
const reviews = await read("lib/reviews.ts");
const services = await read("lib/services.ts");
const env = process.env;

const block = [];
const note = [];

if (/reviewsArePlaceholder = true/.test(reviews)) block.push("Reviews are written placeholders. Replace with genuine reviews in lib/reviews.ts and set reviewsArePlaceholder = false.");
if (/phone: \{[^}]*isPlaceholder: true/.test(business)) block.push("Phone number is the placeholder (514) 555-0142. Set the real number in lib/business.ts.");
if (/area: \{\s*[^]*?isPlaceholder: true/.test(business)) block.push("Service area is pending the owner's confirmation. Confirm towns and outline (lib/business.ts, lib/area.ts).");
if (/social: \{\s*isPlaceholder: true/.test(business)) block.push("Social links point at platform home pages. Set the real profile URLs in lib/business.ts (social.links) and isPlaceholder: false.");
if (/PRICES ARE DRAFTS/.test(services)) block.push("Prices are drafts. Confirm them in lib/services.ts and remove the PRICES ARE DRAFTS note.");
if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID || !env.SQUARE_SERVICES) block.push("Square is not connected (SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_SERVICES). Bookings would go to the stand-in.");
if (env.SQUARE_ACCESS_TOKEN && env.SQUARE_ENVIRONMENT !== "production") block.push("Square is on the sandbox. Set SQUARE_ENVIRONMENT=production.");

if (/depositPercent: null/.test(business)) note.push("No deposit is taken online (depositPercent is null).");
if (/cancellationHours: null/.test(business)) note.push("No cancellation window stated (cancellationHours is null).");
if (!env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) note.push("Map runs on OpenFreeMap + Photon (no key). Set NEXT_PUBLIC_GOOGLE_MAPS_KEY to use Google Maps.");
note.push("Photographs are generated stand-ins: replace with the Renn Bros shoot before launch (public/media, same file names).");
note.push("Home page names car brands (\"Trusted by owners of\"): confirm the client is comfortable with this (their earlier no-marques rule) and that the claim is true.");
note.push("Remove the noindex header in next.config.ts headers() when this concept goes live.");
note.push("Privacy page: name the person responsible for personal information (Québec Law 25).");

for (const b of block) console.log(`BLOCK  ${b}`);
for (const n of note) console.log(`NOTE   ${n}`);
console.log(block.length ? `\nNot ready to launch: ${block.length} blocking item(s).` : "\nReady to launch.");
process.exit(block.length ? 1 : 0);
