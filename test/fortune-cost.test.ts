/**
 * The per-reading budget, checked against the model's real prices.
 *
 * The spend cap reserves `DEFAULT_READING_BUDGET_USD` before every live call
 * and reconciles it down afterwards, so the reservation has to be at least what
 * a worst-case reading can cost — otherwise the cap under-counts and the month
 * overspends.
 */
import { describe, it, expect } from 'vitest';
import { costMicros } from '@/server/pricing';
import { config, DEFAULT_READING_BUDGET_USD, MICROS_PER_USD } from '@/server/config';
import { FORTUNE_MODEL } from '@/server/handlers/fortune';

/** The prompt is a fixed template plus five card names; 400 is generous. */
const MAX_PROMPT_TOKENS = 400;

const usage = {
  promptTokens: MAX_PROMPT_TOKENS,
  completionTokens: config.maxOutputTokens,
};

describe('per-reading budget', () => {
  it('prices a worst-case reading at $0.00048', () => {
    // 400 x $0.15/1M + 700 x $0.60/1M
    expect(config.maxOutputTokens).toBe(700);
    expect(costMicros(FORTUNE_MODEL, usage)).toBe(480);
  });

  it('reserves at least what a worst-case reading can cost', () => {
    const worstCase = costMicros(FORTUNE_MODEL, usage)!;
    expect(worstCase).toBeLessThanOrEqual(
      DEFAULT_READING_BUDGET_USD * MICROS_PER_USD
    );
  });

  it('prices the dated snapshot a completion reports back', () => {
    // The API answers `gpt-4o-mini-2024-07-18`, never the alias that was sent,
    // so an exact-key lookup would bill every live call at the full reservation.
    expect(costMicros(`${FORTUNE_MODEL}-2024-07-18`, usage)).toBe(
      costMicros(FORTUNE_MODEL, usage)
    );
  });

  it('leaves an unpriced model to charge the full reservation', () => {
    expect(costMicros('some-model-nobody-priced', usage)).toBeNull();
  });
});
