/**
 * Square needs a structured address for a visit at the customer's location:
 * street, city (locality), province and postal code. Customers type one line
 * ("123 Lakeshore Rd, Beaconsfield") plus a postal code, so build the parts
 * here. Returns null when it can't be sure of the city or the postal code; the
 * booking then still goes through, with the address in the note.
 */
import { business } from "@/lib/business";

export type SquareAddress = {
  address_line_1: string;
  locality: string;
  administrative_district_level_1: string;
  postal_code: string;
  country: "CA";
};

/** "h9w5l6" / "H9W-5L6" -> "H9W 5L6"; null if it isn't a Canadian postal code. */
export function postalCode(v: string): string | null {
  const m = v.toUpperCase().match(/\b([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])[ -]?(\d[ABCEGHJ-NPRSTV-Z]\d)\b/);
  return m ? `${m[1]} ${m[2]}` : null;
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();

// Common ways people write the towns we serve, mapped to the official name.
const ALIASES: Record<string, string> = {
  "ile bizard": "Île Bizard",
  "l'ile bizard": "Île Bizard",
  "ndip": "Notre-Dame-de-l'Île-Perrot",
  "ile perrot": "L'Île-Perrot",
  "st lazare": "Saint-Lazare",
  "ste anne de bellevue": "Sainte-Anne-de-Bellevue",
  "st anne de bellevue": "Sainte-Anne-de-Bellevue",
  "salaberry de valleyfield": "Valleyfield",
  "vaudreuil": "Vaudreuil-Dorion",
  "pointe claire": "Pointe-Claire",
  "baie d'urfe": "Baie-D'Urfé",
};

/** The town in the typed address: one we serve if it's there (longest name wins), else the part after the first comma. */
export function townIn(raw: string): string | null {
  const text = ` ${fold(raw)} `;
  const known: [string, string][] = [
    ...business.area.towns.map((t) => [fold(t), t] as [string, string]),
    ...Object.entries(ALIASES),
  ].sort((a, b) => b[0].length - a[0].length);
  for (const [key, name] of known) if (text.includes(` ${key} `)) return name;
  // Otherwise "street, Town[, QC][ postal]".
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const town = parts[1].replace(/\b(QC|Québec|Quebec|Canada)\b/gi, "").replace(/[A-Z]\d[A-Z][ -]?\d[A-Z]\d/gi, "").trim();
  return town.length >= 2 ? town : null;
}

export function toSquareAddress(raw: string, postal: string): SquareAddress | null {
  const code = postalCode(postal) ?? postalCode(raw);
  const town = townIn(raw);
  const street = raw.split(",")[0]?.trim();
  if (!code || !town || !street) return null;
  return { address_line_1: street, locality: town, administrative_district_level_1: "QC", postal_code: code, country: "CA" };
}
