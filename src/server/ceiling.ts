/**
 * How often a generation ran into `PF_MAX_OUTPUT_TOKENS`.
 *
 * A ceiling hit means the model was still writing when the request cut it off,
 * so the visitor was handed less than the prompt asked for. That should be
 * unreachable — the ceiling sits ~15% above the reading's shape — which is
 * exactly why it has to be visible: a ceiling hit that happens *regularly* is a
 * token limit set too low, and the only signal used to be a log line nobody
 * reads.
 *
 * Shaped after `noteStoreFailure` / `storeFailures` in `store.ts`, and carrying
 * the same caveat: the count is per-instance and dies with the lambda, so a
 * zero on `/api/status` is weaker evidence than the log.
 */
import { config } from './config';

let hitCount = 0;

/** Bookkeeping only: this is called from the generation path and never throws. */
export function noteCeilingHit(detail: string) {
  hitCount += 1;
  try {
    console.warn(
      `[pixel-fortune] completion hit max_completion_tokens (${config.maxOutputTokens}); ${detail}`
    );
  } catch {
    // A log that cannot be written must not cost a visitor their reading.
  }
}

/** Per-instance, like the memory store — a log line is the durable record. */
export function ceilingHits(): number {
  return hitCount;
}

/** Test seam, mirroring `resetStoreForTests`. */
export function resetCeilingHitsForTests() {
  hitCount = 0;
}
