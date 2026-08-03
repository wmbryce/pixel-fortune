/**
 * The generation request and what comes back from it: the reading is bounded by
 * the token ceiling, and a completion that hits that ceiling is never handed to
 * the visitor with a sentence stopping mid-word.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CardType } from '@/types';

const create = vi.hoisted(() => vi.fn());
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

import { generateFortune, FORTUNE_MODEL } from '@/server/handlers/fortune';
import { config } from '@/server/config';
import { MAX_PROMPT_TOKENS } from '@/server/model';
import { ceilingHits, resetCeilingHitsForTests } from '@/server/ceiling';

const HAND: CardType[] = ['The Star', 'The Moon', 'The Sun', 'The Tower', 'The Fool'].map(
  (name, id) => ({ id, name, image: `/${id}.png` })
);

const completion = (content: string, finish_reason = 'stop') => ({
  model: `${FORTUNE_MODEL}-2024-07-18`,
  choices: [{ message: { content }, finish_reason }],
  usage: { prompt_tokens: 190, completion_tokens: 610 },
});

beforeEach(() => {
  create.mockReset();
  resetCeilingHitsForTests();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// The warn spy is asserted on per spec, so its calls must not carry over.
afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateFortune', () => {
  it('asks the chosen model for a bounded completion', async () => {
    create.mockResolvedValue(completion('A reading.'));

    await generateFortune(HAND);

    const request = create.mock.calls[0][0];
    expect(request.model).toBe('gpt-4o-mini');
    expect(request.max_completion_tokens).toBe(config.maxOutputTokens);
    // The reading's shape is what the dialog box pages on, so the prompt has to
    // keep asking for blank-line-separated plain prose.
    expect(request.messages[0].content).toContain('blank line');
    expect(request.messages[0].content).toContain('no markdown');
    for (const card of HAND) {
      expect(request.messages[0].content).toContain(card.name);
    }
  });

  it('keeps the prompt inside the bound the reservation is derived from', async () => {
    create.mockResolvedValue(completion('A reading.'));

    await generateFortune(HAND);

    // MAX_PROMPT_TOKENS is load-bearing: the reservation is derived from it, and
    // the charge is capped at the reservation, so a prompt that outgrows it
    // overspends the month silently. Counted at a deliberately pessimistic 3
    // characters per token (English prose averages ~4) rather than tokenising
    // for real.
    const prompt = create.mock.calls[0][0].messages[0].content;
    expect(prompt.length).toBeLessThanOrEqual(MAX_PROMPT_TOKENS * 3);
  });

  it('returns a finished reading untouched', async () => {
    const reading = 'Past paragraph.\n\nPresent paragraph.\n\nFuture paragraph.';
    create.mockResolvedValue(completion(reading));

    await expect(generateFortune(HAND)).resolves.toMatchObject({
      reading,
      truncated: false,
    });
    expect(console.warn).not.toHaveBeenCalled();
    expect(ceilingHits()).toBe(0);
  });

  it('trims a completion that ran into the token ceiling', async () => {
    create.mockResolvedValue(
      completion('A finished sentence. And one that stops mid-w', 'length')
    );

    const generated = await generateFortune(HAND);

    expect(generated?.reading).toBe('A finished sentence.');
    expect(generated?.truncated).toBe(true);
    // Dropping text is the bug this fix exists to kill, so it is never silent.
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('trimmed 25 unfinished characters')
    );
    expect(ceilingHits()).toBe(1);
  });

  it.each(['?', '!'])(
    'keeps a sentence that ended in %s rather than trimming past it',
    async mark => {
      create.mockResolvedValue(
        completion(`So what do you fear${mark} The Tower says you already kn`, 'length')
      );

      const generated = await generateFortune(HAND);

      expect(generated?.reading).toBe(`So what do you fear${mark}`);
    }
  );

  it('marks the cut when there is no complete sentence to keep', async () => {
    create.mockResolvedValue(completion('The Tower speaks of a fall you already kn', 'length'));

    const generated = await generateFortune(HAND);

    // Nothing to trim back to, so the loss is visible in the reading itself
    // rather than handed over as a word that stops mid-air.
    expect(generated?.reading).toBe('The Tower speaks of a fall you already…');
    expect(console.warn).toHaveBeenCalled();
  });

  it('records a ceiling hit that needed no trim, without claiming one', async () => {
    const reading = 'A reading that ended exactly on the ceiling.';
    create.mockResolvedValue(completion(reading, 'length'));

    // The signal is finish_reason, not whether the text happened to need
    // cutting: a generation cut off mid-reading is truncated either way.
    await expect(generateFortune(HAND)).resolves.toMatchObject({
      reading,
      truncated: true,
    });
    expect(ceilingHits()).toBe(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('nothing was trimmed')
    );
  });

  it('counts every ceiling hit', async () => {
    create.mockResolvedValue(completion('Cut short mid-w', 'length'));

    await generateFortune(HAND);
    await generateFortune(HAND);

    expect(ceilingHits()).toBe(2);
  });
});
