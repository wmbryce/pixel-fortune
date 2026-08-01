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
import { getStore, noteStoreFailure } from './store';

/**
 * A reservation carries the month and amount it was charged to, so it is
 * always settled against the counter it actually moved. Resolving the month at
 * settle time instead would credit a refund to the wrong month whenever a hold
 * outlives midnight UTC on the 1st, which quietly raises the new month's cap.
 */
export type Reservation = {
  month: string;
  identity: string;
  micros: number;
  token: string;
};

const monthOf = (now: Date) => now.toISOString().slice(0, 7);

const previousMonthOf = (now: Date) =>
  monthOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));

const spendKey = (month: string) => `pf:spend:${month}`;

/**
 * One hold set per spend month. Partitioning by month is what keeps a refund
 * on the counter it was charged to *and* keeps the sweep a single range delete,
 * because every member of a set maps to exactly one counter.
 */
const holdsKey = (month: string) => `pf:holds:${month}`;

/** Unresolved holds for one rate-limit identity, scored by expiry. */
const identityHoldsKey = (identity: string) => `pf:holds:id:${identity}`;

/**
 * Reservations that were never spent are refunded here. Without this an
 * abandoned draw would eat its reservation forever, and hammering the (free)
 * draw endpoint would exhaust the month's cap without generating a reading.
 * `ZREMRANGEBYSCORE` is atomic and reports how many members *this* caller
 * removed, so a refund can never be applied twice.
 *
 * The current and previous month cover every hold that can still matter: a
 * reservation only ever expires in the month it was made or the next one. An
 * older set can only be non-empty after a month of no traffic, and its counter
 * is never read again. Per-identity sets are deliberately left alone — they
 * prune themselves by score the next time that identity deals, so sweeping
 * them here would trade one command for one per expired hold.
 */
export async function sweepExpiredHolds(): Promise<number> {
  const store = getStore();
  const now = new Date();
  const months = [...new Set([monthOf(now), previousMonthOf(now)])];

  const reclaimed = await Promise.all(
    months.map(async month => {
      const expired = await store.zRemRangeByScore(
        holdsKey(month),
        0,
        now.getTime()
      );
      if (expired > 0) {
        await store.incrBy(
          spendKey(month),
          -expired * config.readingBudgetMicros
        );
      }
      return expired;
    })
  );

  return reclaimed.reduce((total, count) => total + count, 0);
}

/**
 * Reserves one reading's budget against the cap. Returns the reservation when
 * it fits, or null when the caller must serve from cache instead.
 *
 * Unresolved holds are also bounded per identity. A real visitor has one
 * reading in flight; without this bound a handful of identities could park the
 * whole reservation pool for the hold TTL and pin the site in cached mode
 * without ever spending a cent. Exceeding it demotes, exactly like the rate
 * limit — it is never an error.
 *
 * Both bounds are enforced by taking the slot first and asking where it landed,
 * never by reading a total and then acting on it. Reading a cardinality first
 * lets a burst from one identity all observe the same count and all pass;
 * `ZRANK` after the insert gives each caller a distinct position — the same
 * property that makes the `INCRBY` below unbypassable — so exactly the first
 * `maxConcurrentHolds` survive however they interleave.
 */
export async function reserveReading(
  token: string,
  identity: string
): Promise<Reservation | null> {
  const store = getStore();
  const now = Date.now();
  const expiresAt = now + config.holdTtlSeconds * 1000;
  const identityKey = identityHoldsKey(identity);

  await store.zRemRangeByScore(identityKey, 0, now);
  await store.zAdd(identityKey, expiresAt, token);
  await store.expire(identityKey, config.holdTtlSeconds);
  const rank = await store.zRank(identityKey, token);
  if (rank === null || rank >= config.maxConcurrentHolds) {
    await store.zRem(identityKey, token);
    return null;
  }

  const reservation: Reservation = {
    month: monthOf(new Date(now)),
    identity,
    micros: config.readingBudgetMicros,
    token,
  };

  const total = await store.incrBy(
    spendKey(reservation.month),
    reservation.micros
  );
  if (total > config.monthlyCapMicros) {
    await store.incrBy(spendKey(reservation.month), -reservation.micros);
    await store.zRem(identityKey, token);
    return null;
  }

  await store.zAdd(holdsKey(reservation.month), expiresAt, token);
  return reservation;
}

/**
 * Claims a live reservation. Exactly one caller can claim a given token, which
 * is what stops a replayed token from buying a second generation.
 *
 * The claim commits on that first `ZREM` — after it the sweep can never refund
 * this reservation — so nothing that follows may fail the caller. Releasing the
 * identity slot is housekeeping: losing it only delays that slot to the hold's
 * expiry, whereas failing here would charge a visitor for a reading and then
 * hand them the cold-start text instead.
 */
export async function claimReservation(
  reservation: Reservation
): Promise<boolean> {
  const store = getStore();
  const claimed =
    (await store.zRem(holdsKey(reservation.month), reservation.token)) === 1;
  if (claimed) {
    await store
      .zRem(identityHoldsKey(reservation.identity), reservation.token)
      .catch(error => noteStoreFailure('claimReservation.identitySlot', error));
  }
  return claimed;
}

/**
 * Settles a claimed reservation against what the call actually cost. `actual`
 * is capped at the reservation so a mispriced model can never push past the
 * ceiling; an unknown model prices at the full reservation.
 */
export async function commitReading(
  reservation: Reservation,
  actualMicros: number | null
) {
  const charged = Math.min(actualMicros ?? reservation.micros, reservation.micros);
  if (charged !== reservation.micros) {
    await getStore().incrBy(
      spendKey(reservation.month),
      charged - reservation.micros
    );
  }
}

/** Gives a reservation back when the generation failed and cost nothing. */
export async function refundReservation(reservation: Reservation) {
  await getStore().incrBy(spendKey(reservation.month), -reservation.micros);
}

export type BudgetStatus = {
  month: string;
  spentMicros: number;
  capMicros: number;
  remainingMicros: number;
  capReached: boolean;
};

export async function budgetStatus(): Promise<BudgetStatus> {
  const month = monthOf(new Date());
  const spentMicros = Number((await getStore().get(spendKey(month))) ?? 0);
  const capMicros = config.monthlyCapMicros;
  const remainingMicros = Math.max(capMicros - spentMicros, 0);
  return {
    month,
    spentMicros,
    capMicros,
    remainingMicros,
    capReached: remainingMicros < config.readingBudgetMicros,
  };
}
