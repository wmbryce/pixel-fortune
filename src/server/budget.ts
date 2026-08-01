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

/** How many expired holds one sweep reclaims, so a backlog cannot stall a deal. */
const SWEEP_BATCH = 100;

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

const spendKey = (month: string) => `pf:spend:${month}`;

/** Unresolved holds for one rate-limit identity, scored by expiry. */
const identityHoldsKey = (identity: string) => `pf:holds:id:${identity}`;

// `|` cannot occur in a month, a hex digest, an integer, or a UUID.
const holdMember = (r: Reservation) =>
  `${r.month}|${r.identity}|${r.micros}|${r.token}`;

const parseHoldMember = (member: string): Reservation | null => {
  const [month, identity, micros, token] = member.split('|');
  if (!month || !identity || !token || !Number.isFinite(Number(micros))) {
    return null;
  }
  return { month, identity, micros: Number(micros), token };
};

/**
 * Reservations that were never spent are refunded here. Without this an
 * abandoned draw would eat its reservation forever, and hammering the (free)
 * draw endpoint would exhaust the month's cap without generating a reading.
 * Each member is removed with `ZREM`, which reports whether *this* caller
 * removed it, so a refund can never be applied twice.
 */
export async function sweepExpiredHolds(): Promise<number> {
  const store = getStore();
  const expired = await store.zRangeByScore(
    HOLDS_KEY,
    0,
    Date.now(),
    SWEEP_BATCH
  );
  if (expired.length === 0) return 0;

  const claimed = await Promise.all(
    expired.map(async member =>
      (await store.zRem(HOLDS_KEY, member)) === 1
        ? parseHoldMember(member)
        : null
    )
  );

  const refunds = new Map<string, number>();
  const reclaimed: Reservation[] = [];
  for (const reservation of claimed) {
    if (!reservation) continue;
    reclaimed.push(reservation);
    refunds.set(
      reservation.month,
      (refunds.get(reservation.month) ?? 0) + reservation.micros
    );
  }

  await Promise.all([
    ...[...refunds].map(([month, micros]) =>
      store.incrBy(spendKey(month), -micros)
    ),
    ...reclaimed.map(r => store.zRem(identityHoldsKey(r.identity), r.token)),
  ]);

  return reclaimed.length;
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
 */
export async function reserveReading(
  token: string,
  identity: string
): Promise<Reservation | null> {
  const store = getStore();
  const now = Date.now();
  const identityKey = identityHoldsKey(identity);

  await store.zRemRangeByScore(identityKey, 0, now);
  if ((await store.zCard(identityKey)) >= config.maxConcurrentHolds) return null;

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
    return null;
  }

  const expiresAt = now + config.holdTtlSeconds * 1000;
  await store.zAdd(HOLDS_KEY, expiresAt, holdMember(reservation));
  await store.zAdd(identityKey, expiresAt, token);
  await store.expire(identityKey, config.holdTtlSeconds);
  return reservation;
}

/**
 * Claims a live reservation. Exactly one caller can claim a given token, which
 * is what stops a replayed token from buying a second generation.
 */
export async function claimReservation(
  reservation: Reservation
): Promise<boolean> {
  const store = getStore();
  const claimed = (await store.zRem(HOLDS_KEY, holdMember(reservation))) === 1;
  if (claimed) {
    await store.zRem(
      identityHoldsKey(reservation.identity),
      reservation.token
    );
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
