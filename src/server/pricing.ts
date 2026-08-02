/**
 * What a completion actually cost, used to reconcile a reservation downwards.
 *
 * Deliberately partial. An unmapped model prices at the full reservation, which
 * keeps the cap correct — over-charging can only ever under-spend. Whoever
 * changes the model should add its row here to get accurate numbers back on
 * `/api/status`.
 */
import { MICROS_PER_USD } from './config';

type Price = { inputPerMTokUsd: number; outputPerMTokUsd: number };

const PRICES: Record<string, Price> = {
  'gpt-4o-mini': { inputPerMTokUsd: 0.15, outputPerMTokUsd: 0.6 },
};

export type Usage = { promptTokens: number; completionTokens: number };

/**
 * A completion reports the dated snapshot it ran on (`gpt-4o-mini-2024-07-18`),
 * not the alias the request asked for, so an exact-key lookup would miss every
 * live call and silently bill each one at the full reservation.
 */
function priceOf(model: string): Price | undefined {
  if (PRICES[model]) return PRICES[model];
  const alias = Object.keys(PRICES).find(name => model.startsWith(`${name}-`));
  return alias ? PRICES[alias] : undefined;
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
