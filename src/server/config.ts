/**
 * Budget knobs. Read lazily so a deploy can retune them without a rebuild, and
 * so tests can stub the environment without re-importing the module graph.
 *
 * Money is carried in micro-dollars (1e-6 USD) everywhere below the UI: the
 * spend cap is enforced with an atomic integer increment, and floats would let
 * rounding drift past the ceiling.
 */
export const MICROS_PER_USD = 1_000_000;

const usdEnv = (name: string, fallbackUsd: number) => {
  const raw = Number(process.env[name]);
  const usd = Number.isFinite(raw) && raw >= 0 ? raw : fallbackUsd;
  return Math.round(usd * MICROS_PER_USD);
};

const intEnv = (name: string, fallback: number) => {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
};

export const config = {
  /** Ceiling on live generation per calendar month. */
  get monthlyCapMicros() {
    return usdEnv('PF_MONTHLY_CAP_USD', 5);
  },
  /**
   * What one reading may cost. Reserved up front, reconciled down to the real
   * usage afterwards. Also the ceiling ticket #12 has to pick a model under.
   */
  get readingBudgetMicros() {
    return usdEnv('PF_READING_BUDGET_USD', 0.01);
  },
  /** Hard stop on completion length, so a runaway generation cannot outspend its reservation. */
  get maxOutputTokens() {
    return intEnv('PF_MAX_OUTPUT_TOKENS', 1200);
  },
  /** Live draws per visitor per window before that visitor is served from cache. */
  get visitorRateLimit() {
    return intEnv('PF_RATE_VISITOR', 5);
  },
  /** Same, per source IP — the backstop when cookies are cleared. */
  get ipRateLimit() {
    return intEnv('PF_RATE_IP', 20);
  },
  get rateWindowSeconds() {
    return intEnv('PF_RATE_WINDOW_SECONDS', 600);
  },
  /** Cached readings retained. Bounded so the pool stays cheap to sample. */
  get cacheMaxEntries() {
    return intEnv('PF_CACHE_MAX', 500);
  },
  /**
   * How long a reservation survives between the draw and the reading. The arc
   * takes a couple of minutes; an hour covers a distracted visitor, and past
   * that the reservation is refunded rather than left to rot against the cap.
   */
  get holdTtlSeconds() {
    return intEnv('PF_HOLD_TTL_SECONDS', 3600);
  },
} as const;
