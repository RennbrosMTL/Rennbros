/**
 * Deposit scenarios against a fake Square that behaves like the real one on
 * the parts that matter: idempotency keys (same key = same object back),
 * holds that are only charged when captured, and failures on demand.
 * Run: npm run test:deposit (npx tsx scripts/deposit-scenarios.mts)
 */
import { checkout, DepositDeclined } from "../lib/booking/checkout";
import { depositCents, estimateOf } from "../lib/booking/deposit";
import type { BookInput, BookResult, HoldInput, Payment } from "../lib/booking/square";

type Fail = Partial<Record<"hold" | "book" | "capture" | "release", boolean>>;

function fakeSquare(fail: Fail = {}) {
  const payments = new Map<string, Payment & { key: string }>();
  const bookings = new Map<string, BookResult>();
  const calls: string[] = [];
  return {
    payments,
    bookings,
    calls,
    /** What the customer actually paid: captured payments only. */
    charged: () => [...payments.values()].filter((p) => p.status === "COMPLETED").reduce((n, p) => n + p.amountCents, 0),
    holds: () => [...payments.values()].filter((p) => p.status === "APPROVED").length,
    async hold(i: HoldInput) {
      calls.push("hold");
      if (fail.hold) throw Object.assign(new Error("Square 402"), { detail: [{ code: "CARD_DECLINED" }] });
      const seen = payments.get(i.idempotencyKey);
      if (seen) return { ...seen };
      const p = { id: `pay_${payments.size + 1}`, status: "APPROVED", amountCents: i.amountCents, key: i.idempotencyKey };
      payments.set(i.idempotencyKey, p);
      return { ...p };
    },
    async book(i: BookInput) {
      calls.push("book");
      if (fail.book) throw Object.assign(new Error("Square 409"), { status: 409 });
      const key = i.idempotencyKey!;
      if (!bookings.has(key)) bookings.set(key, { id: `bk_${bookings.size + 1}`, status: "PENDING" });
      return bookings.get(key)!;
    },
    async capture(id: string) {
      calls.push("capture");
      if (fail.capture) throw new Error("Square 500");
      const p = [...payments.values()].find((x) => x.id === id)!;
      p.status = "COMPLETED";
      return { ...p };
    },
    async release(id: string) {
      calls.push("release");
      if (fail.release) throw new Error("Square 500");
      const p = [...payments.values()].find((x) => x.id === id)!;
      if (p.status === "APPROVED") p.status = "CANCELED";
    },
  };
}

const input: Omit<BookInput, "idempotencyKey"> = {
  slugs: ["oil-change"],
  slot: { startAt: "2026-10-07T12:00:00Z", minutes: 90 },
  customer: { givenName: "Test", email: "t@example.com", phone: "5145550100" },
  address: "1 Main St, Pincourt",
  place: null,
  note: "Services: oil-change",
  lang: "en",
};
const dep = (amountCents: number) => ({ amountCents, sourceId: "cnon:card-ok", note: "Deposit" });
const quiet = { error: () => {}, warn: () => {} };

let failed = 0;
const ok = (cond: boolean, name: string, info = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
};

// --- Amounts: 20% of the estimate shown -------------------------------------
const table: [string[], string | undefined, boolean, number][] = [
  [["oil-change"], undefined, false, 2500],
  [["brakes"], undefined, false, 2500],
  [["battery"], undefined, false, 2500],
  [["diagnostics"], undefined, false, 2500],
  [["tires"], undefined, false, 1600],
  [["tpms"], undefined, false, 800],
  [["ppi"], undefined, false, 3600],
  [["ac-diagnostic"], undefined, false, 3000],
  [["tire-install"], "15-16", false, 2000],
  [["tire-install"], "17-18", true, 2800],
  [["tire-install"], "21+", false, 3200],
  [["tire-install", "brakes"], "17-18", false, 4900],
  [["oil-change", "brakes", "battery"], undefined, false, 7500],
];
for (const [slugs, rim, rf, want] of table) {
  const got = depositCents(slugs, 20, rim as never, rf);
  ok(got === want, `deposit ${slugs.join("+")}${rim ? ` ${rim}"` : ""}${rf ? " run-flat" : ""} = $${(want / 100).toFixed(2)}`, `got $${(got / 100).toFixed(2)} of $${estimateOf(slugs, rim as never, rf)}`);
}
ok(depositCents(["oil-change"], null) === 0 && depositCents(["oil-change"], 0) === 0, "no deposit when the percent is off");

// --- 1. Happy path ------------------------------------------------------------
{
  const sq = fakeSquare();
  const r = await checkout(sq, "a1", input, dep(2500), quiet);
  ok(r.deposit?.captured === true && sq.charged() === 2500 && sq.bookings.size === 1, "happy path: one booking, $25 charged once", sq.calls.join(" → "));
  ok(sq.calls.join(",") === "hold,book,capture", "order is hold → book → capture");
}

// --- 2. Double click / network retry with the same attempt ------------------
{
  const sq = fakeSquare();
  await checkout(sq, "a2", input, dep(2500), quiet);
  await checkout(sq, "a2", input, dep(2500), quiet);
  await checkout(sq, "a2", input, dep(2500), quiet);
  ok(sq.charged() === 2500 && sq.payments.size === 1 && sq.bookings.size === 1, "sent three times: still one payment, one booking, $25 once", `${sq.payments.size} payment(s), ${sq.bookings.size} booking(s)`);
}

// --- 3. Card declined ---------------------------------------------------------
{
  const sq = fakeSquare({ hold: true });
  let declined = false;
  try { await checkout(sq, "a3", input, dep(2500), quiet); } catch (e) { declined = e instanceof DepositDeclined; }
  ok(declined && sq.bookings.size === 0 && sq.charged() === 0, "card declined: no booking, nothing charged");
}

// --- 4. Booking refused after the hold (slot taken, Square down) -------------
{
  const sq = fakeSquare({ book: true });
  let threw = false;
  try { await checkout(sq, "a4", input, dep(2500), quiet); } catch { threw = true; }
  ok(threw && sq.charged() === 0 && sq.holds() === 0 && sq.calls.includes("release"), "booking refused: hold released, nothing charged", sq.calls.join(" → "));
}

// --- 5. Booking refused AND release fails -------------------------------------
{
  const sq = fakeSquare({ book: true, release: true });
  const errors: unknown[] = [];
  try { await checkout(sq, "a5", input, dep(2500), { error: (...a) => errors.push(a), warn: () => {} }); } catch {}
  ok(sq.charged() === 0 && errors.length === 1, "booking refused, release fails: never charged (Square drops the hold in 30 min), error logged");
}

// --- 6. Capture fails after the booking ---------------------------------------
{
  const sq = fakeSquare({ capture: true });
  const errors: unknown[] = [];
  const r = await checkout(sq, "a6", input, dep(2500), { error: (...a) => errors.push(a), warn: () => {} });
  ok(r.booking.id === "bk_1" && r.deposit?.captured === false && sq.charged() === 0 && errors.length === 1, "capture fails: booking stands, not charged, owner alerted in the log");
}

// --- 7. Customer changes the visit and books again (new attempt) -------------
{
  const sq = fakeSquare();
  await checkout(sq, "a7-one", input, dep(2500), quiet);
  await checkout(sq, "a7-two", { ...input, slugs: ["oil-change", "brakes"] }, dep(5000), quiet);
  ok(sq.payments.size === 2 && sq.bookings.size === 2 && sq.charged() === 7500, "two different bookings: two deposits (each its own booking)");
}

// --- 8. Same attempt, different amount (should never happen) ----------------
{
  const sq = fakeSquare();
  await checkout(sq, "a8", input, dep(2500), quiet);
  let threw = false;
  try { await checkout(sq, "a8", input, dep(5000), quiet); } catch (e) { threw = e instanceof DepositDeclined; }
  ok(threw && sq.charged() === 2500 && sq.bookings.size === 1, "same attempt with another amount: refused, no second booking or charge");
}

// --- 9. No deposit configured -------------------------------------------------
{
  const sq = fakeSquare();
  await checkout(sq, "a9", input, null, quiet);
  ok(sq.calls.join(",") === "book" && sq.charged() === 0, "deposit off: booking only, no payment calls");
}

// --- 10. Square says the payment is already completed (replay of a finished attempt)
{
  const sq = fakeSquare();
  await checkout(sq, "a10", input, dep(2500), quiet);
  const before = sq.calls.length;
  await checkout(sq, "a10", input, dep(2500), quiet);
  ok(!sq.calls.slice(before).includes("capture") && sq.charged() === 2500, "replay after success: no second capture");
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
