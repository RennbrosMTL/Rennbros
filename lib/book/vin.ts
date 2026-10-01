/**
 * Reading a VIN from a photo, in the browser:
 *   1. the barcode on the door-frame sticker (BarcodeDetector, where the
 *      browser has it: Chrome on Android, recent Safari);
 *   2. otherwise text recognition (Tesseract), loaded only when someone
 *      actually picks a photo, limited to the characters a VIN can contain.
 * Candidates are checked with the VIN check digit (position 9, used on every
 * North American vehicle), so a misread is caught instead of typed in.
 * Then the free NHTSA decoder fills in year, make and model.
 */

const MAP: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export const cleanVin = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** 17 characters, no I/O/Q, and the check digit adds up. */
export function isValidVin(v: string): boolean {
  const s = cleanVin(v);
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(s)) return false;
  const sum = [...s].reduce((n, c, i) => n + (/\d/.test(c) ? Number(c) : MAP[c]) * WEIGHTS[i], 0);
  const check = sum % 11 === 10 ? "X" : String(sum % 11);
  return s[8] === check;
}

/** Plausible: 17 VIN characters, a real model-year letter in position 10,
 *  and a numeric serial end (positions 14-17), as on North American VINs. */
const plausible = (v: string) => /^[A-HJ-NPR-Z0-9]{9}[A-HJ-NPR-TV-Y1-9][A-HJ-NPR-Z0-9]{3}\d{4}$/.test(v);

/** VIN-shaped runs in recognised text, line by line (never across lines),
 *  text after "VIN" first, with the usual misreads fixed (O→0, I→1, Q→0). */
export function vinsIn(text: string): string[] {
  const out: string[] = [];
  const lines = text.toUpperCase().split(/\r?\n/);
  // The OCR alphabet has no I or O, so "VIN" comes back as "VN" or "V1N".
  const tagged = lines.flatMap((l) => l.match(/V[1I]?N[\s:#.]*([A-Z0-9 ]{17,24})/)?.[1] ?? []);
  for (const line of [...tagged, ...lines]) {
    const flat = line.replace(/[\s\-.:]/g, "").replace(/O/g, "0").replace(/Q/g, "0").replace(/I/g, "1");
    for (let i = 0; i + 17 <= flat.length; i++) {
      const chunk = flat.slice(i, i + 17);
      if (plausible(chunk) && !out.includes(chunk)) out.push(chunk);
    }
  }
  return out;
}

type Detector = { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> };

async function fromBarcode(img: ImageBitmap): Promise<string | null> {
  const BD = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (!BD) return null;
  try {
    const found = await new BD({ formats: ["code_39", "code_128", "data_matrix", "qr_code", "pdf417"] }).detect(img);
    for (const f of found) {
      for (const v of [cleanVin(f.rawValue), cleanVin(f.rawValue).replace(/^I/, "")]) if (isValidVin(v)) return v;
      const c = vinsIn(f.rawValue).find(isValidVin);
      if (c) return c;
    }
  } catch {}
  return null;
}

let tesseract: Promise<{ recognize: (img: HTMLCanvasElement) => Promise<string> }> | null = null;
function ocr() {
  tesseract ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
    s.onload = async () => {
      try {
        const T = (window as unknown as { Tesseract: any }).Tesseract;
        const worker = await T.createWorker("eng");
        await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789" });
        resolve({ recognize: async (c) => (await worker.recognize(c)).data.text as string });
      } catch (e) {
        reject(e);
      }
    };
    s.onerror = reject;
    document.head.append(s);
  });
  return tesseract;
}

function canvasOf(img: ImageBitmap, max = 1800): HTMLCanvasElement {
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const g = c.getContext("2d")!;
  // Grey and contrast up: stickers are often glossy and low contrast.
  g.filter = "grayscale(1) contrast(1.6)";
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export type VinRead = { vin: string; checked: boolean } | null;

export async function readVin(file: File): Promise<VinRead> {
  const img = await createImageBitmap(file);
  const bar = await fromBarcode(img);
  if (bar) return { vin: bar, checked: true };
  const text = await (await ocr()).recognize(canvasOf(img));
  const found = vinsIn(text);
  const good = found.find(isValidVin);
  if (good) return { vin: good, checked: true };
  // Outside North America the 9th character isn't a check digit: offer it, flagged.
  return found[0] ? { vin: found[0], checked: false } : null;
}

export type Decoded = { year?: string; make?: string; model?: string };

/** Year, make and model from NHTSA's free decoder (no key, no personal data sent). */
export async function decodeVin(vin: string): Promise<Decoded> {
  try {
    const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
    const row = (await r.json())?.Results?.[0] ?? {};
    const title = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
    return {
      year: row.ModelYear || undefined,
      make: row.Make ? title(row.Make) : undefined,
      model: row.Model || undefined,
    };
  } catch {
    return {};
  }
}
