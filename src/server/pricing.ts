/**
 * What a completion actually cost, used to reconcile a reservation downwards.
 *
 * Deliberately partial. An unmapped model prices at the full reservation, which
 * keeps the cap correct — over-charging can only ever under-spend. Whoever
 * changes the model (ticket #12) should add its row here to get accurate
 * numbers back on `/api/status`.
 */
import { MICROS_PER_USD } from './config';

type Price = { inputPerMTokUsd: number; outputPerMTokUsd: number };

const PRICES: Record<string, Price> = {
  'gpt-3.5-turbo-16k': { inputPerMTokUsd: 3, outputPerMTokUsd: 4 },
};

export type Usage = { promptTokens: number; completionTokens: number };

/** Micro-dollars, or null when the model is unpriced here. */
export function costMicros(model: string, usage: Usage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  const usd =
    (usage.promptTokens * price.inputPerMTokUsd +
      usage.completionTokens * price.outputPerMTokUsd) /
    1_000_000;
  return Math.ceil(usd * MICROS_PER_USD);
}
