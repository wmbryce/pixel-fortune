/**
 * Every budget state, readable without opening the logs: whether live
 * generation is still affordable this month, how large the reading cache has
 * grown, and whether the store behind both is actually working. Public and
 * read-only — it carries no secret, and the numbers are in a public repo anyway.
 *
 * A failing store is contained everywhere else, which means visitors silently
 * receive the cold-start reading. Reporting `live` through that would make the
 * one failure mode nobody can see from the outside also the one this endpoint
 * exists to expose, so a store that cannot answer — or that recently failed a
 * command while serving — reads as `degraded` rather than as a mode.
 */
import { budgetStatus } from '@/server/budget';
import { cacheSize } from '@/server/cache';
import { config, MICROS_PER_USD } from '@/server/config';
import { getStore, noteStoreFailure, storeFailures } from '@/server/store';

export const dynamic = 'force-dynamic';

/** How long a swallowed failure keeps the site reported as degraded. */
const DEGRADED_WINDOW_MS = 5 * 60 * 1000;

const usd = (micros: number) =>
  Number((micros / MICROS_PER_USD).toFixed(6));

export async function GET() {
  const [budget, cached] = await Promise.all([
    budgetStatus().catch(error => {
      noteStoreFailure('status.budget', error);
      return null;
    }),
    cacheSize().catch(error => {
      noteStoreFailure('status.cache', error);
      return null;
    }),
  ]);

  const perReading = config.readingBudget;
  const failures = storeFailures();
  const failedRecently =
    failures.last !== null &&
    Date.now() - Date.parse(failures.last.at) < DEGRADED_WINDOW_MS;
  const reachable = budget !== null && cached !== null;

  const mode = !reachable || failedRecently
    ? 'degraded'
    : budget.capReached
      ? 'cached'
      : 'live';

  return Response.json({
    mode,
    store: {
      kind: getStore().kind,
      reachable,
      // Per-instance, so a zero here is weaker evidence than the log.
      failures: failures.count,
      lastFailure: failures.last,
    },
    month: budget?.month ?? null,
    spentUsd: budget ? usd(budget.spentMicros) : null,
    capUsd: budget ? usd(budget.capMicros) : null,
    remainingUsd: budget ? usd(budget.remainingMicros) : null,
    readingsRemaining: budget
      ? Math.floor(budget.remainingMicros / perReading.micros)
      : null,
    cachedReadings: cached,
    // Derived, so the number reported here is the number the cap enforces.
    perReadingBudgetUsd: usd(perReading.micros),
    perReadingBudgetDerived: perReading.derived,
    model: perReading.model,
    maxPromptTokens: perReading.maxPromptTokens,
    maxOutputTokens: perReading.maxOutputTokens,
  });
}
