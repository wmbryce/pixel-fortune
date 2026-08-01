/**
 * Durable state for the spend cap, the rate limiter, and the reading cache.
 *
 * Redis is the backing store on Vercel (Upstash, added from the storage
 * marketplace — the successor to Vercel KV). It is picked over the first-party
 * options because the spend cap is only unbypassable if reserving budget is a
 * single atomic operation: Blob and Edge Config are read-modify-write, so two
 * concurrent draws would both read the same total and both proceed. `INCRBY`
 * settles that server-side. Redis is also the only one of the three that
 * survives a cold start *and* is cheap enough to touch on every draw.
 *
 * Talked to over its REST API with `fetch` rather than a client library: eight
 * commands do not justify a dependency, and REST works unchanged in every
 * runtime Vercel might place the route in.
 *
 * The in-memory fallback exists so `npm run dev` and an unconfigured preview
 * still serve readings. It is per-instance and dies with the lambda, which is
 * why `/api/status` reports which store is live.
 */

export type StoreKind = 'redis' | 'memory';

export interface Store {
  readonly kind: StoreKind;
  incrBy(key: string, by: number): Promise<number>;
  get(key: string): Promise<string | null>;
  setEx(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Fixed-window counter: increments and (re)arms the window on first use. */
  incrWithTtl(key: string, ttlSeconds: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  zAdd(key: string, score: number, member: string): Promise<void>;
  /** Returns 1 when this caller removed the member, 0 when someone else already had. */
  zRem(key: string, member: string): Promise<number>;
  zRemRangeByScore(key: string, min: number, max: number): Promise<number>;
  /**
   * Position of a member in score order, or null when it is absent. Distinct
   * per member even for identical scores, which is what lets concurrent callers
   * each learn their own place in a bounded set rather than a shared total.
   */
  zRank(key: string, member: string): Promise<number | null>;
  rPush(key: string, value: string): Promise<number>;
  lTrim(key: string, start: number, stop: number): Promise<void>;
  lLen(key: string): Promise<number>;
  lIndex(key: string, index: number): Promise<string | null>;
}

const redisCredentials = () => {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '';
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';
  return url && token ? { url, token } : null;
};

function createRedisStore({
  url,
  token,
}: {
  url: string;
  token: string;
}): Store {
  const send = async (command: (string | number)[]): Promise<unknown> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command.map(String)),
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`redis ${command[0]} failed: ${res.status}`);
    }
    const body = (await res.json()) as { result?: unknown; error?: string };
    if (body.error) throw new Error(`redis ${command[0]}: ${body.error}`);
    return body.result ?? null;
  };

  const num = async (command: (string | number)[]) => Number(await send(command));
  const str = async (command: (string | number)[]) => {
    const result = await send(command);
    return result === null || result === undefined ? null : String(result);
  };

  return {
    kind: 'redis',
    incrBy: (key, by) => num(['INCRBY', key, by]),
    get: key => str(['GET', key]),
    setEx: async (key, value, ttl) => {
      await send(['SET', key, value, 'EX', ttl]);
    },
    incrWithTtl: async (key, ttl) => {
      const value = await num(['INCR', key]);
      if (value === 1) await send(['EXPIRE', key, ttl]);
      return value;
    },
    expire: async (key, ttl) => {
      await send(['EXPIRE', key, ttl]);
    },
    zAdd: async (key, score, member) => {
      await send(['ZADD', key, score, member]);
    },
    zRem: (key, member) => num(['ZREM', key, member]),
    zRemRangeByScore: (key, min, max) =>
      num(['ZREMRANGEBYSCORE', key, min, max]),
    zRank: async (key, member) => {
      const rank = await send(['ZRANK', key, member]);
      return rank === null || rank === undefined ? null : Number(rank);
    },
    rPush: (key, value) => num(['RPUSH', key, value]),
    lTrim: async (key, start, stop) => {
      await send(['LTRIM', key, start, stop]);
    },
    lLen: key => num(['LLEN', key]),
    lIndex: (key, index) => str(['LINDEX', key, index]),
  };
}

type MemoryEntry = { value: string; expiresAt: number | null };

function createMemoryStore(): Store & { clear(): void } {
  const strings = new Map<string, MemoryEntry>();
  const lists = new Map<string, string[]>();
  const zsets = new Map<string, Map<string, number>>();
  const zsetExpiry = new Map<string, number>();

  const live = (key: string) => {
    const entry = strings.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      strings.delete(key);
      return null;
    }
    return entry;
  };

  const liveZset = (key: string) => {
    const expiresAt = zsetExpiry.get(key);
    if (expiresAt !== undefined && expiresAt <= Date.now()) {
      zsets.delete(key);
      zsetExpiry.delete(key);
    }
    return zsets.get(key) ?? null;
  };

  return {
    kind: 'memory',
    clear() {
      strings.clear();
      lists.clear();
      zsets.clear();
      zsetExpiry.clear();
    },
    async incrBy(key, by) {
      const entry = live(key);
      const next = Number(entry?.value ?? 0) + by;
      strings.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    },
    async get(key) {
      return live(key)?.value ?? null;
    },
    async setEx(key, value, ttl) {
      strings.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    },
    async incrWithTtl(key, ttl) {
      const entry = live(key);
      const next = Number(entry?.value ?? 0) + 1;
      strings.set(key, {
        value: String(next),
        expiresAt: entry?.expiresAt ?? Date.now() + ttl * 1000,
      });
      return next;
    },
    async expire(key, ttl) {
      const at = Date.now() + ttl * 1000;
      const entry = strings.get(key);
      if (entry) entry.expiresAt = at;
      if (zsets.has(key)) zsetExpiry.set(key, at);
    },
    async zAdd(key, score, member) {
      const set = liveZset(key) ?? new Map<string, number>();
      set.set(member, score);
      zsets.set(key, set);
    },
    async zRem(key, member) {
      return liveZset(key)?.delete(member) ? 1 : 0;
    },
    async zRemRangeByScore(key, min, max) {
      const set = liveZset(key);
      if (!set) return 0;
      let removed = 0;
      for (const [member, score] of [...set]) {
        if (score >= min && score <= max) {
          set.delete(member);
          removed += 1;
        }
      }
      return removed;
    },
    async zRank(key, member) {
      const set = liveZset(key);
      if (!set?.has(member)) return null;
      // Redis breaks score ties lexicographically by member.
      const ordered = [...set].sort(
        ([aMember, aScore], [bMember, bScore]) =>
          aScore - bScore || aMember.localeCompare(bMember)
      );
      return ordered.findIndex(([name]) => name === member);
    },
    async rPush(key, value) {
      const list = lists.get(key) ?? [];
      list.push(value);
      lists.set(key, list);
      return list.length;
    },
    async lTrim(key, start, stop) {
      const list = lists.get(key);
      if (!list) return;
      const from = start < 0 ? Math.max(list.length + start, 0) : start;
      const to = stop < 0 ? list.length + stop : stop;
      lists.set(key, list.slice(from, to + 1));
    },
    async lLen(key) {
      return lists.get(key)?.length ?? 0;
    },
    async lIndex(key, index) {
      const list = lists.get(key);
      if (!list) return null;
      return list[index < 0 ? list.length + index : index] ?? null;
    },
  };
}

let store: Store | null = null;
const memory = createMemoryStore();

export function getStore(): Store {
  if (!store) {
    const credentials = redisCredentials();
    store = credentials ? createRedisStore(credentials) : memory;
  }
  return store;
}

export type StoreFailure = { scope: string; message: string; at: string };

let lastFailure: StoreFailure | null = null;
let failureCount = 0;

/**
 * Store failures are contained rather than shown to the visitor, so this is the
 * only trace they leave. Without it a store that fails one command per request
 * degrades every reading to the cold-start text while `/api/status` still
 * reports the site as generating live — silent, total, and undiagnosable.
 */
export function noteStoreFailure(scope: string, error: unknown) {
  failureCount += 1;
  lastFailure = {
    scope,
    message: error instanceof Error ? error.message : String(error),
    at: new Date().toISOString(),
  };
  console.error(`[pixel-fortune] store failure (${scope})`, error);
}

/** Per-instance, like the memory store — a log line is the durable record. */
export function storeFailures(): { count: number; last: StoreFailure | null } {
  return { count: failureCount, last: lastFailure };
}

/** Test seam: drops all in-memory state and re-resolves the backend. */
export function resetStoreForTests() {
  memory.clear();
  store = null;
  lastFailure = null;
  failureCount = 0;
}
