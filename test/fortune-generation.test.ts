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

const HAND: CardType[] = ['The Star', 'The Moon', 'The Sun', 'The Tower', 'The Fool'].map(
  (name, id) => ({ id, name, image: `/${id}.png`, description: name })
);

const completion = (content: string, finish_reason = 'stop') => ({
  model: `${FORTUNE_MODEL}-2024-07-18`,
  choices: [{ message: { content }, finish_reason }],
  usage: { prompt_tokens: 190, completion_tokens: 610 },
});

beforeEach(() => {
  create.mockReset();
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

  it('returns a finished reading untouched', async () => {
    const reading = 'Past paragraph.\n\nPresent paragraph.\n\nFuture paragraph.';
    create.mockResolvedValue(completion(reading));

    await expect(generateFortune(HAND)).resolves.toMatchObject({ reading });
  });

  it('trims a completion that ran into the token ceiling', async () => {
    create.mockResolvedValue(
      completion('A finished sentence. And one that stops mid-w', 'length')
    );

    const generated = await generateFortune(HAND);

    expect(generated?.reading).toBe('A finished sentence.');
    // Dropping text is the bug this fix exists to kill, so it is never silent.
    expect(console.warn).toHaveBeenCalled();
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

  it('does not claim a trim it did not make', async () => {
    const reading = 'A reading that ended exactly on the ceiling.';
    create.mockResolvedValue(completion(reading, 'length'));

    await expect(generateFortune(HAND)).resolves.toMatchObject({ reading });
    expect(console.warn).not.toHaveBeenCalled();
  });
});
