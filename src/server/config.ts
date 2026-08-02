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

/**
 * The per-reading budget, derived rather than estimated.
 *
 * `gpt-4o-mini` at $0.15 / $0.60 per million input / output tokens. The prompt
 * is a fixed template plus five card names — under 400 tokens even generously —
 * and the completion is capped at `maxOutputTokens`:
 *
 *   400 in  x $0.15/1M = $0.00006
 *   700 out x $0.60/1M = $0.00042
 *                        --------
 *   worst case           $0.00048
 *
 * Reserved at $0.0006, ~25% above that ceiling, because a reservation must
 * never be smaller than what the call can actually cost. At the $5 default
 * monthly cap that is >8,000 live readings a month, against ~500 under the old
 * $0.01 estimate — which is most of the point of the model choice: more live
 * readings means the reading cache fills faster.
 */
export const DEFAULT_READING_BUDGET_USD = 0.0006;

export const config = {
  /** Ceiling on live generation per calendar month. Zero is the kill switch. */
  get monthlyCapMicros() {
    return usdEnv('PF_MONTHLY_CAP_USD', 5);
  },
  /**
   * What one reading may cost. Reserved up front, reconciled down to the real
   * usage afterwards. See `DEFAULT_READING_BUDGET_USD` for how the default is
   * derived from the model's price and the token ceiling.
   *
   * Must be strictly positive: a zero reservation increments the spend counter
   * by nothing, so the cap would never be reached and every request would run
   * live. `Number('') === 0`, so a defined-but-blank env var would otherwise
   * disable the whole cap silently.
   */
  get readingBudgetMicros() {
    const micros = usdEnv('PF_READING_BUDGET_USD', DEFAULT_READING_BUDGET_USD);
    return micros > 0
      ? micros
      : Math.round(DEFAULT_READING_BUDGET_USD * MICROS_PER_USD);
  },
  /**
   * Hard stop on completion length, so a runaway generation cannot outspend its
   * reservation. 700 is ~15% of headroom over the four ~600-character
   * paragraphs the prompt asks for, so a well-behaved reading finishes on its
   * own and the ceiling only ever catches a runaway.
   */
  get maxOutputTokens() {
    return intEnv('PF_MAX_OUTPUT_TOKENS', 700);
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
   * takes a couple of minutes; ten covers a distracted visitor, and past that
   * the reservation is refunded rather than left to rot against the cap. Kept
   * short because an outstanding hold is budget nobody else can spend.
   */
  get holdTtlSeconds() {
    return intEnv('PF_HOLD_TTL_SECONDS', 600);
  },
  /**
   * Unresolved holds one identity may have at once. A real visitor has exactly
   * one reading in flight, so anything above this is abuse — and bounding it is
   * what stops a few identities parking the whole reservation pool, which a
   * short TTL alone only makes more tedious.
   */
  get maxConcurrentHolds() {
    return intEnv('PF_MAX_CONCURRENT_HOLDS', 2);
  },
} as const;
