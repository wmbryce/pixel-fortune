/**
 * The per-reading budget, checked against the model's real prices.
 *
 * The spend cap reserves `config.readingBudgetMicros` before every live call
 * and reconciles it down afterwards, so the reservation has to be at least what
 * a worst-case reading can cost — otherwise the cap under-counts and the month
 * overspends. That is why the reservation is derived from the token ceiling
 * rather than configured beside it: the two cannot drift if there is only one.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { costMicros } from '@/server/pricing';
import { config, UNPRICED_READING_BUDGET_USD, MICROS_PER_USD } from '@/server/config';
import { FORTUNE_MODEL, MAX_PROMPT_TOKENS } from '@/server/model';

const worstCaseMicros = () =>
  costMicros(FORTUNE_MODEL, {
    promptTokens: MAX_PROMPT_TOKENS,
    completionTokens: config.maxOutputTokens,
  })!;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('per-reading budget', () => {
  it('prices a worst-case reading at $0.00048', () => {
    // 400 x $0.15/1M + 700 x $0.60/1M
    expect(config.maxOutputTokens).toBe(700);
    expect(worstCaseMicros()).toBe(480);
  });

  it('reserves at least what a worst-case reading can cost', () => {
    expect(config.readingBudgetMicros).toBe(600);
    expect(worstCaseMicros()).toBeLessThanOrEqual(config.readingBudgetMicros);
    expect(config.readingBudget.derived).toBe(true);
  });

  it('moves the reservation with the token ceiling', () => {
    // The coupling this derivation exists for: raising only the ceiling used to
    // leave the reservation behind, and the charge is capped at the reservation
    // when it settles, so the month would overspend while /api/status read
    // under-cap.
    const before = config.readingBudgetMicros;

    vi.stubEnv('PF_MAX_OUTPUT_TOKENS', '2000');

    expect(config.readingBudgetMicros).toBeGreaterThan(before);
    expect(worstCaseMicros()).toBeLessThanOrEqual(config.readingBudgetMicros);
  });

  it('never derives a zero reservation from a blank or bad ceiling', () => {
    // `Number('') === 0`, and a zero reservation never moves the spend counter,
    // so a blank value must fall back rather than disable the cap.
    for (const value of ['', '0', '-1', 'nonsense']) {
      vi.stubEnv('PF_MAX_OUTPUT_TOKENS', value);
      expect(config.maxOutputTokens).toBe(700);
      expect(config.readingBudgetMicros).toBe(600);
    }
  });

  it('falls back to a conservative reservation when the model is unpriced', async () => {
    vi.resetModules();
    vi.doMock('@/server/model', () => ({
      FORTUNE_MODEL: 'some-model-nobody-priced',
      MAX_PROMPT_TOKENS,
    }));

    const { config: unpriced } = await import('@/server/config');

    expect(unpriced.readingBudget.derived).toBe(false);
    expect(unpriced.readingBudgetMicros).toBe(
      UNPRICED_READING_BUDGET_USD * MICROS_PER_USD
    );
    expect(unpriced.readingBudgetMicros).toBeGreaterThan(worstCaseMicros());

    vi.doUnmock('@/server/model');
  });

  it('prices the dated snapshot a completion reports back', () => {
    // The API answers `gpt-4o-mini-2024-07-18`, never the alias that was sent,
    // so an exact-key lookup would bill every live call at the full reservation.
    const usage = { promptTokens: MAX_PROMPT_TOKENS, completionTokens: 700 };
    expect(costMicros(`${FORTUNE_MODEL}-2024-07-18`, usage)).toBe(
      costMicros(FORTUNE_MODEL, usage)
    );
  });

  it('prices a snapshot off the longest matching row, not the first', () => {
    // `gpt-4o` is a prefix of every `gpt-4o-mini-*` snapshot, so a first-match
    // lookup would price mini calls at 16x depending on table order alone.
    const usage = { promptTokens: MAX_PROMPT_TOKENS, completionTokens: 700 };
    expect(costMicros('gpt-4o-mini-2024-07-18', usage)).toBe(
      costMicros('gpt-4o-mini', usage)
    );
    expect(costMicros('gpt-4o-2024-08-06', usage)).toBeGreaterThan(
      costMicros('gpt-4o-mini-2024-07-18', usage)!
    );
  });

  it('leaves an unpriced model to charge the full reservation', () => {
    expect(
      costMicros('some-model-nobody-priced', {
        promptTokens: MAX_PROMPT_TOKENS,
        completionTokens: 700,
      })
    ).toBeNull();
  });
});
