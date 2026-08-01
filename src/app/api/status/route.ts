/**
 * Both budget states, readable without opening the logs: whether live
 * generation is still affordable this month, and how large the reading cache
 * has grown. Public and read-only — it carries no secret, and the numbers are
 * in a public repo anyway.
 */
import { budgetStatus } from '@/server/budget';
import { cacheSize } from '@/server/cache';
import { config, MICROS_PER_USD } from '@/server/config';
import { getStore } from '@/server/store';

export const dynamic = 'force-dynamic';

const usd = (micros: number) =>
  Number((micros / MICROS_PER_USD).toFixed(6));

export async function GET() {
  const [budget, cached] = await Promise.all([budgetStatus(), cacheSize()]);

  return Response.json({
    mode: budget.capReached ? 'cached' : 'live',
    store: getStore().kind,
    month: budget.month,
    spentUsd: usd(budget.spentMicros),
    capUsd: usd(budget.capMicros),
    remainingUsd: usd(budget.remainingMicros),
    readingsRemaining: Math.floor(
      budget.remainingMicros / config.readingBudgetMicros
    ),
    cachedReadings: cached,
    perReadingBudgetUsd: usd(config.readingBudgetMicros),
    maxOutputTokens: config.maxOutputTokens,
  });
}
