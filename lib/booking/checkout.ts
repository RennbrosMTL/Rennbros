/**
 * Booking with a deposit, in an order that can't charge a customer for a
 * booking that doesn't exist, or charge them twice:
 *
 *   1. HOLD the deposit on the card (authorized, not charged). Declined card:
 *      stop here; nothing is booked, nothing is charged.
 *   2. BOOK in Square. Refused (slot just taken, Square down): RELEASE the
 *      hold; nothing is charged. If the release itself fails, Square drops
 *      the hold on its own after 30 minutes.
 *   3. CAPTURE the hold: now the deposit is charged. If the capture fails, the
 *      booking stands and the hold lapses in 30 minutes, so the customer is
 *      not charged; the owner is told (log + booking note) to collect it.
 *
 * Every Square call carries a key derived from one attempt id. Resending the
 * same request (double click, flaky network, retry) gets the same payment and
 * the same booking back from Square: never a second charge or a duplicate.
 */
import type { BookInput, BookResult, BookingProvider, Payment } from "./square";

export type DepositRequest = {
  amountCents: number;
  sourceId: string;
  verificationToken?: string;
  buyerEmail?: string;
  note: string;
};

export type CheckoutResult = {
  booking: BookResult;
  deposit?: { payment: Payment; captured: boolean };
};

/** Raised when the card hold fails: nothing was booked or charged. */
export class DepositDeclined extends Error {
  detail: unknown;
  constructor(detail: unknown) {
    super("deposit declined");
    this.detail = detail;
  }
}

export async function checkout(
  p: Pick<BookingProvider, "book" | "hold" | "capture" | "release">,
  attempt: string,
  input: Omit<BookInput, "idempotencyKey">,
  deposit: DepositRequest | null,
  log: Pick<Console, "error" | "warn"> = console,
): Promise<CheckoutResult> {
  if (!deposit || deposit.amountCents <= 0) {
    return { booking: await p.book({ ...input, idempotencyKey: `bk-${attempt}` }) };
  }

  // 1 · Hold.
  let payment: Payment;
  try {
    payment = await p.hold({
      sourceId: deposit.sourceId,
      verificationToken: deposit.verificationToken,
      amountCents: deposit.amountCents,
      idempotencyKey: `dep-${attempt}`,
      buyerEmail: deposit.buyerEmail,
      note: deposit.note,
    });
  } catch (e) {
    throw new DepositDeclined(e instanceof Error && "detail" in e ? (e as { detail: unknown }).detail : e);
  }
  if (payment.amountCents && payment.amountCents !== deposit.amountCents) {
    // Same key, different amount: Square handed back an earlier attempt. Don't book on it.
    await p.release(payment.id).catch(() => {});
    throw new DepositDeclined({ reason: "amount_mismatch", held: payment.amountCents, expected: deposit.amountCents });
  }

  // 2 · Book (the deposit's payment id goes in the booking note).
  const dollars = (deposit.amountCents / 100).toFixed(2);
  let booking: BookResult;
  try {
    booking = await p.book({
      ...input,
      idempotencyKey: `bk-${attempt}`,
      note: `${input.note}\nDeposit: $${dollars} by card online (Square payment ${payment.id}). Check it shows as Completed in Transactions.`,
    });
  } catch (e) {
    try {
      if (payment.status !== "COMPLETED") await p.release(payment.id);
    } catch (r) {
      log.error("[deposit] booking failed AND the hold could not be released; Square drops it in 30 min", payment.id, r);
    }
    throw e;
  }

  // 3 · Capture.
  if (payment.status === "COMPLETED") return { booking, deposit: { payment, captured: true } };
  try {
    const done = await p.capture(payment.id);
    return { booking, deposit: { payment: done, captured: true } };
  } catch (e) {
    log.error(`[deposit] NOT CAPTURED for booking ${booking.id}; hold lapses in 30 min. Collect the deposit by hand.`, payment.id, e);
    return { booking, deposit: { payment, captured: false } };
  }
}
