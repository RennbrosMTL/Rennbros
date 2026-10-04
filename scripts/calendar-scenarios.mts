/**
 * Calendar scenarios against a simulated Square: hourly start times, the work
 * done by 5 pm, and an hour of travel/prep kept free after every booking.
 * Run: npm run test:calendar
 */
import { bookingProvider, bufferAfter, type Schedule } from "../lib/booking/square";

const schedule: Schedule = { arrivals: [8, 9, 10, 11, 12, 13, 14, 15, 16], days: [1, 2, 3, 4, 5], finishBy: 17, buffer: 60 };
const minutes: Record<string, number> = { tpms: 30, battery: 45, "oil-change": 60, brakes: 120, ppi: 90 };
const timing = { each: (s: string) => minutes[s] ?? 60, total: (ss: string[]) => ss.reduce((n, s) => n + (minutes[s] ?? 60), 0) };
const env = {
  accessToken: "test",
  environment: "sandbox" as const,
  locationId: "L1",
  teamMemberId: "TM1",
  serviceVariations: Object.fromEntries(Object.keys(minutes).map((k) => [k, `V-${k}`])),
};

// Tuesday 2026-10-13, Montréal (EDT, UTC-4). Square is open 8:00–17:00.
const DAY = "2026-10-13";
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 13, h + 4, m)).toISOString();
let busy: [number, number][] = []; // [startMinute, endMinute] of bookings in Square, local time
let lastBooking: any = null;

globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  const body = init?.body ? JSON.parse(init.body) : {};
  if (url.endsWith("/v2/bookings/availability/search")) {
    const out = [];
    for (let t = 8 * 60; t + 30 <= 17 * 60; t += 30) {
      if (busy.some(([a, b]) => t < b && t + 30 > a)) continue;
      out.push({ start_at: at(Math.floor(t / 60), t % 60), appointment_segments: [{ duration_minutes: 30 }] });
    }
    return new Response(JSON.stringify({ availabilities: out }));
  }
  if (url.includes("/v2/customers/search")) return new Response(JSON.stringify({ customers: [{ id: "C1" }] }));
  if (url.includes("/v2/catalog/object/")) return new Response(JSON.stringify({ object: { version: 1 } }));
  if (url.endsWith("/v2/bookings")) {
    lastBooking = body.booking;
    return new Response(JSON.stringify({ booking: { id: "B1", status: "PENDING" } }));
  }
  return new Response(JSON.stringify({}), { status: 404 });
}) as typeof fetch;

const p = bookingProvider(env, timing, schedule);
const hours = async (slugs: string[]) =>
  (await p.availability(slugs, new Date(`${DAY}T04:00:00Z`), 1)).map((s) => new Date(s.startAt).getUTCHours() - 4);

let failed = 0;
const ok = (cond: boolean, name: string, info = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
};
const same = (a: number[], b: number[]) => a.join(",") === b.join(",");

busy = [];
let h = await hours(["oil-change"]);
ok(same(h, [8, 9, 10, 11, 12, 13, 14, 15, 16]), "empty day, 1 h job: every hour 8 to 4", h.join(","));
h = await hours(["brakes"]);
ok(same(h, [8, 9, 10, 11, 12, 13, 14, 15]), "empty day, 2 h job: 8 to 3 (done by 5)", h.join(","));
h = await hours(["oil-change", "brakes", "battery"]);
ok(same(h, [8, 9, 10, 11, 12, 13]), "empty day, 3 h 45 visit: 8 to 1", h.join(","));

// A 2 h job booked at 8:00 holds 8:00–11:00 (work + 1 h buffer).
busy = [[8 * 60, 11 * 60]];
h = await hours(["brakes"]);
ok(same(h, [11, 12, 13, 14, 15]), "after an 8:00 brake job: next start 11:00", h.join(","));
h = await hours(["oil-change"]);
ok(same(h, [11, 12, 13, 14, 15, 16]), "after an 8:00 brake job, 1 h job: from 11:00", h.join(","));

// A booking at 13:00–15:00 (+1 h buffer to 16:00): earlier jobs must leave an hour before it.
busy = [[13 * 60, 16 * 60]];
h = await hours(["oil-change"]);
ok(same(h, [8, 9, 10, 11, 16]), "booking at 1 pm: 1 h jobs end with an hour to spare (latest 11:00), then 4:00", h.join(","));

// Owner blocks the whole afternoon in Square.
busy = [[12 * 60, 17 * 60]];
h = await hours(["tpms"]);
ok(same(h, [8, 9, 10]), "afternoon blocked: 30 min job up to 10:00 (buffer before noon)", h.join(","));

// The buffer at the end of the day is cut short, never past 5 pm.
ok(bufferAfter(schedule, at(15), 60) === 60 && bufferAfter(schedule, at(15), 120) === 0 && bufferAfter(schedule, at(16), 30) === 30, "buffer cut short at the end of the day");

// Booking adds the buffer to the last service in Square.
busy = [];
await p.book({ slugs: ["oil-change", "brakes"], slot: { startAt: at(9), minutes: 180 }, customer: { givenName: "A", email: "a@b.co", phone: "5145550100" }, address: "1 Main St, Pincourt", place: null, note: "", lang: "en" });
const segs = lastBooking?.appointment_segments?.map((x: any) => x.duration_minutes).join(",");
ok(segs === "60,180", "booked 9:00 oil + brakes: Square holds 60 + 120 + 60 buffer", segs);
await p.book({ slugs: ["brakes"], slot: { startAt: at(15), minutes: 120 }, customer: { givenName: "A", email: "a@b.co", phone: "5145550100" }, address: "1 Main St", place: null, note: "", lang: "en" });
ok(lastBooking?.appointment_segments?.[0]?.duration_minutes === 120, "booked 3:00 brakes: no buffer past 5 pm", String(lastBooking?.appointment_segments?.[0]?.duration_minutes));

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
