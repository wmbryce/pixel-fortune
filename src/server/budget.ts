/**
 * The hard spend cap.
 *
 * A rate limit bounds rate, not total spend — a patient attacker just waits it
 * out — so the ceiling is enforced here, on money, server-side, and nothing a
 * client sends can influence it.
 *
 * Budget is *reserved* when the hand is dealt and *committed* when the reading
 * comes back. Reserving first is what makes the cap unbypassable: the reserve
 * is a single atomic `INCRBY`, so N concurrent draws produce N distinct totals
 * and only those landing under the cap proceed. Checking-then-calling would let
 * a burst of simultaneous requests all read the same total and all fire.
 *
 * The counter is keyed by calendar month, so the monthly reset needs no cron —
 * a new month is simply a new key.
 */
import { config } from './config';
import { getStore } from './store';

const HOLDS_KEY = 'pf:holds';

const spendKey = (now = new Date()) =>
  `pf:spend:${now.toISOString().slice(0, 7)}`;

/**
 * Reservations that were never spent are refunded here. Without this an
 * abandoned draw would eat its reservation forever, and hammering the (free)
 * draw endpoint would exhaust the month's cap without generating a reading.
 * `ZREMRANGEBYSCORE` is atomic and reports how many members *this* caller
 * removed, so a refund can never be applied twice.
 */
export async function sweepExpiredHolds(): Promise<number> {
  const store = getStore();
  const expired = await store.zRemRangeByScore(HOLDS_KEY, 0, Date.now());
  if (expired > 0) {
    await store.incrBy(spendKey(), -expired * config.readingBudgetMicros);
  }
  return expired;
}

/**
 * Reserves one reading's budget against the cap. Returns the hold token when
 * the reservation fits, or null when the cap is reached and the caller must
 * serve from cache instead.
 */
export async function reserveReading(token: string): Promise<boolean> {
  const store = getStore();
  const budget = config.readingBudgetMicros;
  const total = await store.incrBy(spendKey(), budget);
  if (total > config.monthlyCapMicros) {
    await store.incrBy(spendKey(), -budget);
    return false;
  }
  await store.zAdd(HOLDS_KEY, Date.now() + config.holdTtlSeconds * 1000, token);
  return true;
}

/**
 * Claims a live reservation. Exactly one caller can claim a given token, which
 * is what stops a replayed token from buying a second generation.
 */
export async function claimReservation(token: string): Promise<boolean> {
  return (await getStore().zRem(HOLDS_KEY, token)) === 1;
}

/**
 * Settles a claimed reservation against what the call actually cost. `actual`
 * is capped at the reservation so a mispriced model can never push past the
 * ceiling; an unknown model prices at the full reservation.
 */
export async function commitReading(actualMicros: number | null) {
  const budget = config.readingBudgetMicros;
  const charged = Math.min(actualMicros ?? budget, budget);
  if (charged !== budget) {
    await getStore().incrBy(spendKey(), charged - budget);
  }
}

/** Gives a reservation back when the generation failed and cost nothing. */
export async function refundReservation() {
  await getStore().incrBy(spendKey(), -config.readingBudgetMicros);
}

export type BudgetStatus = {
  month: string;
  spentMicros: number;
  capMicros: number;
  remainingMicros: number;
  capReached: boolean;
};

export async function budgetStatus(): Promise<BudgetStatus> {
  const spentMicros = Number((await getStore().get(spendKey())) ?? 0);
  const capMicros = config.monthlyCapMicros;
  const remainingMicros = Math.max(capMicros - spentMicros, 0);
  return {
    month: spendKey().slice('pf:spend:'.length),
    spentMicros,
    capMicros,
    remainingMicros,
    capReached: remainingMicros < config.readingBudgetMicros,
  };
}
