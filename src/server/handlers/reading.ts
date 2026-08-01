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
import { getStore } from '../store';
import {
  claimReservation,
  commitReading,
  refundReservation,
  reserveReading,
  sweepExpiredHolds,
} from '../budget';
import { cacheReading, randomCachedReading } from '../cache';
import { withinRateLimit, Visitor } from '../rate-limit';
import { costMicros } from '../pricing';
import { COLD_START_READING } from '../data/cold-start-reading';
import { createTarotDeck } from './deck';
import { generateFortune } from './fortune';

type Hold =
  | { mode: 'live'; hand: CardType[] }
  | { mode: 'cached'; hand: CardType[]; reading: string };

export type DealtHand = { hand: CardType[]; token: string };

const holdKey = (token: string) => `pf:hold:${token}`;

const drawHand = (): CardType[] => createTarotDeck().slice(0, 5);

export async function dealHand(visitor: Visitor): Promise<DealtHand> {
  await sweepExpiredHolds();

  const token = randomUUID();
  // Rate limit first: a throttled visitor must not consume a reservation.
  const live = (await withinRateLimit(visitor)) && (await reserveReading(token));

  const hold: Hold = live
    ? { mode: 'live', hand: drawHand() }
    : await cachedHold();

  await getStore().setEx(
    holdKey(token),
    JSON.stringify(hold),
    config.holdTtlSeconds
  );

  return { hand: hold.hand, token };
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
  const raw = await getStore().get(holdKey(token));
  if (!raw) return COLD_START_READING;

  let hold: Hold;
  try {
    hold = JSON.parse(raw) as Hold;
  } catch {
    return COLD_START_READING;
  }

  if (hold.mode === 'cached') return hold.reading;

  // Exactly one caller claims a reservation, so a replayed token cannot buy a
  // second generation.
  if (!(await claimReservation(token))) return COLD_START_READING;

  let generated;
  try {
    generated = await generateFortune(hold.hand);
  } catch {
    generated = null;
  }
  if (!generated) {
    await refundReservation();
    return COLD_START_READING;
  }

  await commitReading(costMicros(generated.model, generated.usage));
  await cacheReading({
    handIds: hold.hand.map(card => card.id),
    reading: generated.reading,
    model: generated.model,
    createdAt: new Date().toISOString(),
  });

  // Rewrite the hold as cached so a retry or a double-submit replays this
  // reading instead of paying for another one.
  await getStore().setEx(
    holdKey(token),
    JSON.stringify({
      mode: 'cached',
      hand: hold.hand,
      reading: generated.reading,
    } satisfies Hold),
    config.holdTtlSeconds
  );

  return generated.reading;
}
