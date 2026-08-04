/**
 * Decides how a visitor's reading gets written, and hands back the spread that
 * belongs to it.
 *
 * Live AI while there is budget; the reading cache once the cap is reached.
 * Both paths return the same shape on the same two calls, so the degraded path
 * is invisible — no error, no different layout, no dead dialog.
 *
 * The decision is made once, when the hand is dealt, and never revisited. That
 * is what lets the cache work at all: in cached mode the *reading is chosen
 * first and its cards are dealt*, so the spread on the table is the spread the
 * reading was written about. See `cache.ts` for why the obvious direction —
 * deal, then look up a matching reading — cannot work.
 *
 * The client's only handle on any of this is an opaque token that maps to
 * server-side state. It cannot name a hand, request live mode, or spend twice.
 */
import { randomUUID } from 'node:crypto';
import { CardType } from '@/types';
import { config } from '../config';
import { getStore, noteStoreFailure } from '../store';
import {
  claimReservation,
  commitReading,
  refundReservation,
  reserveReading,
  sweepExpiredHolds,
  Reservation,
} from '../budget';
import { cacheReading, randomCachedReading } from '../cache';
import { withinRateLimit, visitorIdentity, Visitor } from '../rate-limit';
import { costMicros } from '../pricing';
import { COLD_START_READING } from '../data/cold-start-reading';
import { createTarotDeck } from './deck';
import { generateFortune, GeneratedFortune } from './fortune';

type Hold =
  | { mode: 'live'; hand: CardType[]; reservation: Reservation }
  | { mode: 'cached'; hand: CardType[]; reading: string };

export type DealtHand = { hand: CardType[]; token: string };

const holdKey = (token: string) => `pf:hold:${token}`;

/** Exported so `test/deck.test.ts` pins the real deal, not a copy of it. */
export const drawHand = (): CardType[] => createTarotDeck().slice(0, 5);

/**
 * Contained, not ignored: the visitor's experience never depends on these, but
 * `/api/status` and the server log have to show that the site is degrading.
 */
const containStoreFailure = (scope: string) => (error: unknown) => {
  noteStoreFailure(scope, error);
};

export async function dealHand(visitor: Visitor): Promise<DealtHand> {
  const token = randomUUID();

  try {
    await sweepExpiredHolds();

    // Rate limit first: a throttled visitor must not consume a reservation.
    const reservation = (await withinRateLimit(visitor))
      ? await reserveReading(token, visitorIdentity(visitor))
      : null;

    const hold: Hold = reservation
      ? { mode: 'live', hand: drawHand(), reservation }
      : await cachedHold();

    await getStore().setEx(
      holdKey(token),
      JSON.stringify(hold),
      config.holdTtlSeconds
    );

    return { hand: hold.hand, token };
  } catch (error) {
    // The store is the only thing here that can fail, and a store that failed
    // holds no reservation, so nothing was spent. Deal locally rather than
    // reject: an unanswered deal leaves the dialog with no message and no
    // retry, whereas an unreadable hold resolves to the cold-start reading,
    // which names no cards and stays coherent against any spread.
    noteStoreFailure('dealHand', error);
    return { hand: drawHand(), token };
  }
}

/** The inversion: pick the reading, then deal the cards it was written about. */
async function cachedHold(): Promise<Hold> {
  const entry = await randomCachedReading();
  return entry
    ? { mode: 'cached', hand: entry.hand, reading: entry.reading }
    : { mode: 'cached', hand: drawHand(), reading: COLD_START_READING };
}

/**
 * Always resolves to a reading. Every path that cannot write about the spread
 * actually on the table falls back to the card-agnostic cold-start text rather
 * than to some other hand's reading, so what is on screen always describes what
 * is on the table.
 */
export async function resolveReading(token: string): Promise<string> {
  let raw: string | null;
  try {
    raw = await getStore().get(holdKey(token));
  } catch (error) {
    noteStoreFailure('resolveReading.readHold', error);
    return COLD_START_READING;
  }
  if (!raw) return COLD_START_READING;

  let hold: Hold;
  try {
    hold = JSON.parse(raw) as Hold;
  } catch {
    return COLD_START_READING;
  }

  if (hold.mode === 'cached') return hold.reading;

  const { reservation } = hold;
  if (!reservation) return COLD_START_READING;

  // Exactly one caller claims a reservation, so a replayed token cannot buy a
  // second generation.
  let claimed: boolean;
  try {
    claimed = await claimReservation(reservation);
  } catch (error) {
    noteStoreFailure('resolveReading.claim', error);
    return COLD_START_READING;
  }
  if (!claimed) return COLD_START_READING;

  let generated;
  try {
    generated = await generateFortune(hold.hand);
  } catch {
    generated = null;
  }
  if (!generated) {
    await refundReservation(reservation).catch(
      containStoreFailure('resolveReading.refund')
    );
    return COLD_START_READING;
  }

  // The money is spent the moment the generation returns, so reconciling,
  // caching and rewriting the hold are all best-effort: failing any of them
  // must never cost the visitor a reading they already paid for.
  await settleGeneration(token, hold.hand, reservation, generated).catch(
    containStoreFailure('resolveReading.settle')
  );

  return generated.reading;
}

async function settleGeneration(
  token: string,
  hand: CardType[],
  reservation: Reservation,
  generated: GeneratedFortune
) {
  await commitReading(
    reservation,
    costMicros(generated.model, generated.usage)
  );

  // A reading the token ceiling cut short is this visitor's alone: seeding the
  // shared pool with it would re-serve a visibly short reading to everyone
  // else indefinitely, and in cached mode it is the only reading source there
  // is — a transient defect made permanent.
  if (!generated.truncated) {
    await cacheReading({
      handIds: hand.map(card => card.id),
      reading: generated.reading,
      model: generated.model,
      createdAt: new Date().toISOString(),
    });
  }

  // Rewrite the hold as cached so a retry or a double-submit replays this
  // reading instead of paying for another one. A truncated reading is rewritten
  // too: a replay of the same token is the same visitor asking for the reading
  // they already paid for, not another visitor being handed it.
  await getStore().setEx(
    holdKey(token),
    JSON.stringify({
      mode: 'cached',
      hand,
      reading: generated.reading,
    } satisfies Hold),
    config.holdTtlSeconds
  );
}
