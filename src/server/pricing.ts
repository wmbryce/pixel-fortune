/**
 * What a completion costs: used both to derive the per-reading reservation and
 * to reconcile that reservation downwards once the real usage is known.
 *
 * Deliberately partial. An unmapped model prices at the full reservation, which
 * keeps the cap correct — over-charging can only ever under-spend. Whoever
 * changes the model should add its row here to get accurate numbers back on
 * `/api/status`.
 *
 * A leaf module: `config.ts` derives the reservation from it, so it must not
 * import the config back.
 *
 * Money is carried in micro-dollars (1e-6 USD) everywhere below the UI: the
 * spend cap is enforced with an atomic integer increment, and floats would let
 * rounding drift past the ceiling.
 */
export const MICROS_PER_USD = 1_000_000;

type Price = { inputPerMTokUsd: number; outputPerMTokUsd: number };

const PRICES: Record<string, Price> = {
  'gpt-4o': { inputPerMTokUsd: 2.5, outputPerMTokUsd: 10 },
  'gpt-4o-mini': { inputPerMTokUsd: 0.15, outputPerMTokUsd: 0.6 },
};

export type Usage = { promptTokens: number; completionTokens: number };

/**
 * A completion reports the dated snapshot it ran on (`gpt-4o-mini-2024-07-18`),
 * not the alias the request asked for, so an exact-key lookup would miss every
 * live call and silently bill each one at the full reservation.
 *
 * The *longest* matching row wins, never the first: `gpt-4o` is a prefix of
 * every `gpt-4o-mini-*` snapshot, so matching on insertion order would price
 * mini calls at 16x and exhaust the month's cap on a table edit alone.
 */
function priceOf(model: string): Price | undefined {
  const match = Object.keys(PRICES)
    .filter(name => model === name || model.startsWith(`${name}-`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PRICES[match] : undefined;
}

/** Micro-dollars, or null when the model is unpriced here. */
export function costMicros(model: string, usage: Usage): number | null {
  const price = priceOf(model);
  if (!price) return null;
  const usd =
    (usage.promptTokens * price.inputPerMTokUsd +
      usage.completionTokens * price.outputPerMTokUsd) /
    1_000_000;
  return Math.ceil(usd * MICROS_PER_USD);
}
