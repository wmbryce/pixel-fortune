/**
 * The self-populating reading pool.
 *
 * Every live reading is stored with the spread it was written about, so the
 * pool is entirely AI-authored and improves on its own — nothing here is
 * hand-written and nothing has to be seeded.
 *
 * The pool is read back by *picking a reading and dealing its cards*, never by
 * looking up a reading for a spread the visitor already drew. Five cards from
 * 78 is ~2.4e7 ordered combinations before positions are even considered, so a
 * lookup keyed on the draw would miss essentially every time and the cache
 * would be dead weight. Inverting it makes every cached reading exactly as
 * coherent as a live one, because it genuinely was written about the five cards
 * on the table. Do not "fix" this back into a lookup.
 */
import { CardType } from '@/types';
import { config } from './config';
import { getStore } from './store';
import { cardsByIds } from './handlers/deck';

const CACHE_KEY = 'pf:readings';

/**
 * Everything needed to replay a reading: the ordered spread and the text.
 *
 * The spread is stored as card ids, not card objects — position is the array
 * index, and the rest of each card is rehydrated from the deck on the way out
 * so a replay renders against the current deck rather than a snapshot taken
 * when it was written.
 */
export type CachedReading = {
  /** Ordered — index is the position on the table. */
  handIds: number[];
  reading: string;
  model: string;
  createdAt: string;
};

export type ReplayedReading = { hand: CardType[]; reading: string };

export async function cacheReading(entry: CachedReading) {
  const store = getStore();
  await store.rPush(CACHE_KEY, JSON.stringify(entry));
  await store.lTrim(CACHE_KEY, -config.cacheMaxEntries, -1);
}

export async function cacheSize(): Promise<number> {
  return getStore().lLen(CACHE_KEY);
}

export async function randomCachedReading(): Promise<ReplayedReading | null> {
  const store = getStore();
  const size = await store.lLen(CACHE_KEY);
  if (size === 0) return null;
  const raw = await store.lIndex(CACHE_KEY, Math.floor(Math.random() * size));
  if (!raw) return null;

  let entry: CachedReading;
  try {
    entry = JSON.parse(raw) as CachedReading;
  } catch {
    return null;
  }
  if (entry.handIds?.length !== 5 || !entry.reading) return null;

  const hand = cardsByIds(entry.handIds);
  return hand ? { hand, reading: entry.reading } : null;
}
