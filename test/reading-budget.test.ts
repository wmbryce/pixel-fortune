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
import { config, DEFAULT_READING_BUDGET_USD } from '@/server/config';
import { visitorIdentity } from '@/server/rate-limit';
import { TarotDeck } from '@/server/data/tarot-deck';
import {
  getStore,
  resetStoreForTests,
  storeFailures,
  type Store,
} from '@/server/store';

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

type StoreMethod = {
  [K in keyof Store]: Store[K] extends (...args: never[]) => unknown ? K : never;
}[keyof Store];

/** Makes one store operation throw, the way a Redis outage would. */
const breakStore = (method: StoreMethod) => {
  vi.spyOn(getStore(), method as 'get').mockRejectedValue(
    new Error(`redis ${method} failed: 503`)
  );
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

  // Swallowed store failures log; the specs that force one assert on this.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
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

  it('refunds an expired hold to the month it was charged to', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T23:59:00Z'));
    await dealHand(visitor('boundary'));
    expect(Number(await getStore().get('pf:spend:2026-07'))).toBe(10_000);

    // The hold outlives midnight UTC on the 1st. Refunding at sweep time would
    // credit August, pushing its counter negative and raising its cap.
    vi.setSystemTime(new Date('2026-08-01T01:00:00Z'));
    expect(await sweepExpiredHolds()).toBe(1);

    expect(Number(await getStore().get('pf:spend:2026-07'))).toBe(0);
    expect(Number((await getStore().get('pf:spend:2026-08')) ?? 0)).toBe(0);

    const status = await budgetStatus();
    expect(status.month).toBe('2026-08');
    expect(status.spentMicros).toBe(0);
  });

  it('reclaims a backlog of expired holds without per-hold commands', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    vi.stubEnv('PF_HOLD_TTL_SECONDS', '1');

    for (let i = 0; i < 25; i++) await dealHand(visitor(`ghost-${i}`));
    expect((await budgetStatus()).spentMicros).toBe(25 * 10_000);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5_000);

    const store = getStore();
    const zRem = vi.spyOn(store, 'zRem');
    const zRemRange = vi.spyOn(store, 'zRemRangeByScore');

    expect(await sweepExpiredHolds()).toBe(25);

    expect((await budgetStatus()).spentMicros).toBe(0);
    // One range delete per swept month, not one command per expired hold.
    expect(zRem).not.toHaveBeenCalled();
    expect(zRemRange.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('never refunds the same expired hold twice', async () => {
    vi.stubEnv('PF_HOLD_TTL_SECONDS', '1');
    await dealHand(visitor('ghost-a'));
    await dealHand(visitor('ghost-b'));

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5_000);
    const [first, ...rest] = await Promise.all([
      sweepExpiredHolds(),
      sweepExpiredHolds(),
      sweepExpiredHolds(),
    ]);

    expect(first + rest.reduce((a, b) => a + b, 0)).toBe(2);
    expect((await budgetStatus()).spentMicros).toBe(0);
  });

  it('falls back to the default per-reading budget rather than zero', () => {
    const defaultMicros = DEFAULT_READING_BUDGET_USD * 1_000_000;
    for (const value of ['', '0', '-1', 'nonsense', '0.0000001']) {
      vi.stubEnv('PF_READING_BUDGET_USD', value);
      expect(config.readingBudgetMicros).toBe(defaultMicros);
    }
  });

  it('still enforces the cap when the per-reading budget is blank', async () => {
    // `Number('') === 0`, and a zero reservation never moves the counter, so a
    // blank value used to disable the cap outright.
    vi.stubEnv('PF_READING_BUDGET_USD', '');
    vi.stubEnv('PF_MONTHLY_CAP_USD', String(DEFAULT_READING_BUDGET_USD * 3));
    for (let i = 0; i < 8; i++) await draw(visitor(`blank-${i}`));

    expect(calls).toBe(3);
    expect((await budgetStatus()).capReached).toBe(true);
  });
});

describe('concurrent holds', () => {
  it('demotes to cached mode past the per-identity hold cap', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    vi.stubEnv('PF_MAX_CONCURRENT_HOLDS', '2');

    const seed = await draw(visitor('seed'));
    expect(seed.reading).not.toBe(COLD_START_READING);

    // Two deals parked without ever asking for their reading.
    const parker = visitor('parker');
    await dealHand(parker);
    await dealHand(parker);

    const third = await dealHand(parker);
    const text = await resolveReading(third.token);

    expect(calls).toBe(1);
    expect(third.hand).toEqual(seed.hand);
    expect(text).toBe(seed.reading);
  });

  it('does not block a visitor whose own readings finished', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    vi.stubEnv('PF_MAX_CONCURRENT_HOLDS', '2');

    const regular = visitor('regular');
    for (let i = 0; i < 5; i++) await draw(regular);

    expect(calls).toBe(5);
  });

  it('frees the slot once a parked hold expires', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    vi.stubEnv('PF_MAX_CONCURRENT_HOLDS', '1');
    vi.stubEnv('PF_HOLD_TTL_SECONDS', '1');

    const slow = visitor('slow');
    await dealHand(slow);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5_000);
    const after = await draw(slow);

    expect(calls).toBe(1);
    expect(after.reading).not.toBe(COLD_START_READING);
  });

  it('never leaves more than the bound outstanding under a burst', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    vi.stubEnv('PF_MAX_CONCURRENT_HOLDS', '2');

    // Check-then-act would let all ten read the same count and all reserve,
    // leaving the rate limit (100 per visitor here) as the only real bound.
    const burst = visitor('burst');
    await Promise.all(Array.from({ length: 10 }, () => dealHand(burst)));

    const outstanding = await getStore().zCard(
      `pf:holds:id:${visitorIdentity(burst)}`
    );
    expect(outstanding).toBeLessThanOrEqual(2);
    expect((await budgetStatus()).spentMicros).toBeLessThanOrEqual(2 * 10_000);
    expect((await budgetStatus()).spentMicros).toBe(outstanding * 10_000);
  });

  it('demotes a burst to a coherent cached reading, never an error', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    vi.stubEnv('PF_MAX_CONCURRENT_HOLDS', '1');

    const seed = await draw(visitor('seed'));

    const burst = visitor('burst');
    const dealt = await Promise.all(
      Array.from({ length: 5 }, () => dealHand(burst))
    );
    const readings = await Promise.all(
      dealt.map(hand => resolveReading(hand.token))
    );

    for (const text of readings) expect(text.length).toBeGreaterThan(0);
    expect(readings.filter(text => text === seed.reading).length).toBeGreaterThan(0);
    expect(dealt.every(hand => hand.hand.length === 5)).toBe(true);
  });

  it('keeps dealing when giving a rolled-back slot back fails', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    vi.stubEnv('PF_MAX_CONCURRENT_HOLDS', '1');

    const seed = await draw(visitor('seed'));

    const parker = visitor('parker');
    await dealHand(parker);

    const store = getStore();
    const realZRem = store.zRem.bind(store);
    vi.spyOn(store, 'zRem').mockImplementation((key, member) =>
      key.startsWith('pf:holds:id:')
        ? Promise.reject(new Error('redis ZREM failed: 503'))
        : realZRem(key, member)
    );

    const over = await dealHand(parker);

    expect(over.hand).toHaveLength(5);
    expect(await resolveReading(over.token)).toBe(seed.reading);
    expect(storeFailures().last?.scope).toBe('reserveReading.releaseSlot');
  });

  it('defaults the hold TTL to ten minutes', () => {
    expect(config.holdTtlSeconds).toBe(600);
    expect(config.maxConcurrentHolds).toBe(2);
  });
});

describe('store failures', () => {
  it.each(['setEx', 'incrBy', 'zCard'] as const)(
    'still deals a hand when %s is unreachable',
    async method => {
      breakStore(method);
      const dealt = await dealHand(visitor('offline'));

      expect(dealt.hand).toHaveLength(5);
      expect(dealt.token.length).toBeGreaterThan(0);
    }
  );

  it('resolves an unwritable hold to the cold-start reading', async () => {
    breakStore('setEx');
    const dealt = await dealHand(visitor('offline'));

    expect(await resolveReading(dealt.token)).toBe(COLD_START_READING);
    expect(calls).toBe(0);
  });

  it.each(['rPush', 'setEx'] as const)(
    'keeps a paid-for reading when %s fails after generation',
    async method => {
      const dealt = await dealHand(visitor('paid'));
      breakStore(method);

      const text = await resolveReading(dealt.token);

      expect(calls).toBe(1);
      expect(text).toBe(reading(1));
    }
  );

  it('leaves the reservation charged when settlement fails', async () => {
    const dealt = await dealHand(visitor('paid'));
    breakStore('rPush');
    await resolveReading(dealt.token);

    expect((await budgetStatus()).spentMicros).toBe(10_000);
  });

  it('keeps a paid reading when releasing the identity slot fails', async () => {
    const dealt = await dealHand(visitor('claimer'));

    // The claim commits on the first ZREM; nothing after it may fail the caller.
    const store = getStore();
    const realZRem = store.zRem.bind(store);
    vi.spyOn(store, 'zRem').mockImplementation((key, member) =>
      key.startsWith('pf:holds:id:')
        ? Promise.reject(new Error('redis ZREM failed: 503'))
        : realZRem(key, member)
    );

    const text = await resolveReading(dealt.token);

    expect(calls).toBe(1);
    expect(text).toBe(reading(1));
    expect((await budgetStatus()).spentMicros).toBe(10_000);
    expect(storeFailures().last?.scope).toBe('claimReservation.identitySlot');
  });
});

describe('store health', () => {
  it('records and logs a swallowed store failure', async () => {
    expect(storeFailures().count).toBe(0);

    breakStore('setEx');
    await dealHand(visitor('offline'));

    expect(storeFailures().count).toBeGreaterThan(0);
    expect(storeFailures().last?.scope).toBe('dealHand');
    expect(console.error).toHaveBeenCalled();
  });

  it('reports degraded rather than live once the store has failed', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    breakStore('setEx');
    await dealHand(visitor('offline'));

    const { GET } = await import('@/app/api/status/route');
    const body = await (await GET()).json();

    expect(body.mode).toBe('degraded');
    expect(body.store.failures).toBeGreaterThan(0);
    expect(body.store.lastFailure.scope).toBe('dealHand');
  });

  it('reports live and reachable while the store is healthy', async () => {
    vi.stubEnv('PF_MONTHLY_CAP_USD', '100');
    await draw(visitor('healthy'));

    const { GET } = await import('@/app/api/status/route');
    const body = await (await GET()).json();

    expect(body.mode).toBe('live');
    expect(body.store.reachable).toBe(true);
    expect(body.store.failures).toBe(0);
    expect(body.readingsRemaining).toBeGreaterThan(0);
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

describe('cost accounting', () => {
  // Literal, not `FORTUNE_MODEL`: this file mocks that module out.
  it('reconciles a live reading down to what the model charged', async () => {
    vi.stubEnv('PF_READING_BUDGET_USD', String(DEFAULT_READING_BUDGET_USD));
    generateFortune.mockResolvedValue({
      reading: reading(1),
      model: 'gpt-4o-mini-2024-07-18',
      usage: { promptTokens: 400, completionTokens: 700 },
    });

    await draw();

    // $0.00048 of the $0.0006 reserved, priced off the dated snapshot.
    expect((await budgetStatus()).spentMicros).toBe(480);
  });
});
