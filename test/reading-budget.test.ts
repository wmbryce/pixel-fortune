/**
 * The public-visitor budget story: the cap holds, the cache replays coherently,
 * and neither limit surfaces as an error.
 *
 * Runs against the in-memory store. Its `incrBy` is atomic for the same reason
 * Redis's is — a single-threaded runtime with no await inside the read/write —
 * so the reserve-then-check algorithm is exercised exactly as deployed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CardType } from '@/types';

const generateFortune = vi.hoisted(() => vi.fn());
vi.mock('@/server/handlers/fortune', () => ({
  FORTUNE_MODEL: 'test-model',
  generateFortune,
}));

import { dealHand, resolveReading } from '@/server/handlers/reading';
import { budgetStatus, sweepExpiredHolds } from '@/server/budget';
import { cacheSize, cacheReading, randomCachedReading } from '@/server/cache';
import { COLD_START_READING } from '@/server/data/cold-start-reading';
import { TarotDeck } from '@/server/data/tarot-deck';
import { resetStoreForTests } from '@/server/store';

const PER_READING_USD = 0.01;

let calls = 0;
const reading = (n: number) => `Reading ${n} paragraph one.\n\nParagraph two.`;

const visitor = (id: string, ip = '203.0.113.1') => ({ ip, visitorId: id });

/** A full arc: deal, then ask for the reading behind the dealt hand. */
const draw = async (who = visitor('v1')) => {
  const dealt = await dealHand(who);
  const text = await resolveReading(dealt.token);
  return { ...dealt, reading: text };
};

beforeEach(() => {
  calls = 0;
  generateFortune.mockReset();
  generateFortune.mockImplementation(async () => {
    calls += 1;
    return {
      reading: reading(calls),
      model: 'test-model',
      usage: { promptTokens: 150, completionTokens: 800 },
    };
  });

  vi.stubEnv('PF_READING_BUDGET_USD', String(PER_READING_USD));
  vi.stubEnv('PF_MONTHLY_CAP_USD', String(PER_READING_USD * 3));
  vi.stubEnv('PF_RATE_VISITOR', '100');
  vi.stubEnv('PF_RATE_IP', '1000');
  resetStoreForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('spend cap', () => {
  it('stops live generation at the cap and cannot be pushed past it', async () => {
    for (let i = 0; i < 10; i++) await draw(visitor(`v${i}`));

    expect(calls).toBe(3);
    const status = await budgetStatus();
    expect(status.spentMicros).toBeLessThanOrEqual(status.capMicros);
    expect(status.capReached).toBe(true);
  });

  it('holds under a concurrent burst, where check-then-call would not', async () => {
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => draw(visitor(`burst-${i}`)))
    );

    expect(calls).toBe(3);
    const status = await budgetStatus();
    expect(status.spentMicros).toBeLessThanOrEqual(status.capMicros);
  });

  it('cannot be bypassed by a client-supplied token', async () => {
    await expect(resolveReading('not-a-real-token')).resolves.toBe(
      COLD_START_READING
    );
    expect(calls).toBe(0);
  });

  it('bills a replayed token once', async () => {
    const dealt = await dealHand(visitor('v1'));
    const first = await resolveReading(dealt.token);
    const second = await resolveReading(dealt.token);

    expect(calls).toBe(1);
    expect(second).toBe(first);
  });

  it('charges the reservation, not the model, when the model is unpriced', async () => {
    await draw();
    const status = await budgetStatus();
    expect(status.spentMicros).toBe(10_000);
  });

  it('refunds a reservation the generation never used', async () => {
    generateFortune.mockRejectedValue(new Error('openai down'));

    const text = await draw();
    expect(text.reading).toBe(COLD_START_READING);
    expect((await budgetStatus()).spentMicros).toBe(0);
  });

  it('refunds a draw that was abandoned before its reading', async () => {
    vi.stubEnv('PF_HOLD_TTL_SECONDS', '1');
    await dealHand(visitor('ghost'));
    expect((await budgetStatus()).spentMicros).toBe(10_000);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5_000);
    expect(await sweepExpiredHolds()).toBe(1);
    expect((await budgetStatus()).spentMicros).toBe(0);
  });
});

describe('cached mode', () => {
  it('deals the cards the cached reading was written about', async () => {
    const live = [
      await draw(visitor('v1')),
      await draw(visitor('v2')),
      await draw(visitor('v3')),
    ];
    expect((await randomCachedReading())?.hand).toHaveLength(5);
    expect((await budgetStatus()).capReached).toBe(true);

    // Over the cap the reading is chosen first and its spread is dealt, so the
    // pair on screen is one that was genuinely written together.
    const cached = await draw(visitor('v4'));

    expect(calls).toBe(3);
    expect(cached.reading).not.toBe(COLD_START_READING);
    expect(live).toContainEqual(
      expect.objectContaining({ hand: cached.hand, reading: cached.reading })
    );
  });

  it('replays the exact spread and text that were cached together', async () => {
    const handIds = [7, 21, 3, 60, 14];
    await cacheReading({
      handIds,
      reading: 'A reading about exactly those five cards.',
      model: 'test-model',
      createdAt: new Date().toISOString(),
    });

    vi.stubEnv('PF_MONTHLY_CAP_USD', '0');
    const dealt = await draw(visitor('v9'));

    expect(calls).toBe(0);
    expect(dealt.hand.map((c: CardType) => c.id)).toEqual(handIds);
    expect(dealt.reading).toBe('A reading about exactly those five cards.');
  });

  it('rehydrates a cached spread from the current deck, not a stale snapshot', async () => {
    await cacheReading({
      handIds: [0, 1, 2, 3, 4],
      reading: 'Cached before the descriptions landed.',
      model: 'test-model',
      createdAt: new Date().toISOString(),
    });

    const replayed = await randomCachedReading();
    expect(replayed?.hand.map(c => c.name)).toEqual(
      TarotDeck.slice(0, 5).map(c => c.name)
    );
  });

  it('grows the cache by one per live reading', async () => {
    expect(await cacheSize()).toBe(0);
    await draw(visitor('a'));
    await draw(visitor('b'));
    expect(await cacheSize()).toBe(2);
  });

  it('serves the cold-start reading when the cap is reached with an empty cache', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '0');
    const dealt = await draw();

    expect(calls).toBe(0);
    expect(dealt.hand).toHaveLength(5);
    expect(dealt.reading).toBe(COLD_START_READING);
  });
});

describe('rate limit', () => {
  it('demotes a heavy visitor to cached mode instead of erroring', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    vi.stubEnv('PF_RATE_VISITOR', '2');

    const first = await draw(visitor('heavy'));
    const second = await draw(visitor('heavy'));
    const third = await draw(visitor('heavy'));

    expect(calls).toBe(2);
    expect(third.hand).toHaveLength(5);
    expect(third.reading.length).toBeGreaterThan(0);
    expect([first.reading, second.reading]).toContain(third.reading);
  });

  it('gives a different visitor behind the same IP its own allowance', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    vi.stubEnv('PF_RATE_VISITOR', '1');
    vi.stubEnv('PF_RATE_IP', '10');

    await draw(visitor('nat-a', '198.51.100.7'));
    await draw(visitor('nat-a', '198.51.100.7')); // over their own limit
    await draw(visitor('nat-b', '198.51.100.7')); // fresh allowance

    expect(calls).toBe(2);
  });

  it('falls back to the per-IP ceiling when cookies are cleared', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    vi.stubEnv('PF_RATE_VISITOR', '10');
    vi.stubEnv('PF_RATE_IP', '2');

    for (let i = 0; i < 6; i++) await draw(visitor(`fresh-${i}`, '198.51.100.8'));

    expect(calls).toBe(2);
  });
});
