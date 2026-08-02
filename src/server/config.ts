/**
 * Budget knobs. Read lazily so a deploy can retune them without a rebuild, and
 * so tests can stub the environment without re-importing the module graph.
 *
 * Money is carried in micro-dollars; see `pricing.ts`, which owns the unit.
 */
import { FORTUNE_MODEL, MAX_PROMPT_TOKENS } from './model';
import { costMicros, MICROS_PER_USD } from './pricing';

export { MICROS_PER_USD };

const usdEnv = (name: string, fallbackUsd: number) => {
  const raw = Number(process.env[name]);
  const usd = Number.isFinite(raw) && raw >= 0 ? raw : fallbackUsd;
  return Math.round(usd * MICROS_PER_USD);
};

const intEnv = (name: string, fallback: number) => {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
};

/** Completion ceiling when `PF_MAX_OUTPUT_TOKENS` is unset or unusable. */
const DEFAULT_MAX_OUTPUT_TOKENS = 700;

/**
 * How far the reservation sits above the worst case it is derived from. A
 * reservation must never be smaller than what the call can actually cost, and
 * the derivation is only as exact as the price table, so it carries 25%.
 */
export const RESERVATION_MARGIN = 1.25;

/**
 * Reservation of last resort, used only when `FORTUNE_MODEL` has no row in the
 * price table and the derivation therefore cannot run. Chosen well above any
 * plausible reading (it is ticket #11's original estimate): under-reserving
 * silently overspends the cap, over-reserving only demotes to cached mode
 * early. `/api/status` reports `perReadingBudgetDerived: false` when it is live.
 */
export const UNPRICED_READING_BUDGET_USD = 0.01;

/**
 * The reservation, and what it was derived from.
 *
 * Derived rather than configured, so the token ceiling and the money reserved
 * against it cannot drift: the charge is capped at the reservation when it
 * settles, so a ceiling raised on its own would book a call at less than it
 * cost and quietly overspend the month.
 *
 * `gpt-4o-mini` at $0.15 / $0.60 per million input / output tokens, against the
 * default 700-token ceiling and `MAX_PROMPT_TOKENS`:
 *
 *   400 in  x $0.15/1M = $0.00006
 *   700 out x $0.60/1M = $0.00042
 *                        --------
 *   worst case           $0.00048  -> reserved at $0.0006 with the margin
 *
 * At the $5 default monthly cap that is >8,000 live readings a month, against
 * ~500 under ticket #11's $0.01 estimate — which is most of the point of the
 * model choice: more live readings means the reading cache fills faster.
 */
export type ReadingBudget = {
  micros: number;
  /** False means the fallback is in force because the model is unpriced. */
  derived: boolean;
  model: string;
  maxPromptTokens: number;
  maxOutputTokens: number;
};

const readMaxOutputTokens = () =>
  intEnv('PF_MAX_OUTPUT_TOKENS', DEFAULT_MAX_OUTPUT_TOKENS);

const readReadingBudget = (): ReadingBudget => {
  const maxOutputTokens = readMaxOutputTokens();
  const worstCaseMicros = costMicros(FORTUNE_MODEL, {
    promptTokens: MAX_PROMPT_TOKENS,
    completionTokens: maxOutputTokens,
  });
  const derived = worstCaseMicros !== null && worstCaseMicros > 0;

  return {
    micros: derived
      ? Math.ceil(worstCaseMicros * RESERVATION_MARGIN)
      : Math.round(UNPRICED_READING_BUDGET_USD * MICROS_PER_USD),
    derived,
    model: FORTUNE_MODEL,
    maxPromptTokens: MAX_PROMPT_TOKENS,
    maxOutputTokens,
  };
};

export const config = {
  /** Ceiling on live generation per calendar month. Zero is the kill switch. */
  get monthlyCapMicros() {
    return usdEnv('PF_MONTHLY_CAP_USD', 5);
  },
  /**
   * What one reading may cost, and what that number was derived from. Reserved
   * up front, reconciled down to the real usage afterwards.
   */
  get readingBudget(): ReadingBudget {
    return readReadingBudget();
  },
  /**
   * Always strictly positive: a zero reservation increments the spend counter by
   * nothing, so the cap would never be reached and every request would run live.
   * There is no env override precisely because a blank one (`Number('') === 0`)
   * used to disable the whole cap silently — the ceiling below is the one knob,
   * and the money follows it.
   */
  get readingBudgetMicros() {
    return readReadingBudget().micros;
  },
  /**
   * Hard stop on completion length, and the single operator knob over spend:
   * the reservation is derived from it, so raising it buys longer readings and
   * fewer of them rather than a silently overspent cap. 700 is ~15% of headroom
   * over the four ~600-character paragraphs the prompt asks for, so a
   * well-behaved reading finishes on its own and the ceiling only ever catches
   * a runaway.
   */
  get maxOutputTokens() {
    return readMaxOutputTokens();
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
