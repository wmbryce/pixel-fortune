/**
 * Regression: a page longer than 1000 characters was silently lost.
 *
 * TypingText capped each page at `maxCharacters = 1000` against a `startIndex`
 * nothing advanced, so a long paragraph stopped typing at 1000 characters,
 * `setTypingComplete` never fired, and the Continue button never appeared —
 * the visitor got less than was written, with nothing to say so.
 */
import React, { useState } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TypingText from '@/app/_components/TypingText';

/** Longer than the old ceiling, and longer than any paragraph the prompt asks for. */
const LONG_PAGE = Array.from(
  { length: 40 },
  (_, i) => `Sentence ${i} of a reading that runs long enough to matter.`
).join(' ');

function Harness({ text, skip = false }: { text: string; skip?: boolean }) {
  const [complete, setComplete] = useState(false);
  return (
    <>
      <TypingText text={text} delay={0} skip={skip} setTypingComplete={setComplete} />
      <span data-testid="complete">{String(complete)}</span>
    </>
  );
}

/** Slices so the typewriter's chained promise/timer pairs get a chance to run. */
const runTimers = async (ms: number, slice = 30) => {
  for (let t = 0; t < ms; t += slice) {
    await act(async () => {
      vi.advanceTimersByTime(slice);
    });
  }
};

const body = () => document.querySelector('p.font-pixel')?.textContent ?? '';
const complete = () =>
  document.querySelector('[data-testid="complete"]')?.textContent;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('TypingText', () => {
  it('types out a page longer than the old 1000-character ceiling', async () => {
    expect(LONG_PAGE.length).toBeGreaterThan(1000);
    render(<Harness text={LONG_PAGE} />);

    // 30ms per character, plus slack for the leading delay.
    await runTimers(LONG_PAGE.length * 30 + 500);

    expect(body()).toBe(LONG_PAGE);
    expect(complete()).toBe('true');
  });

  it('reveals a long page in full when the visitor skips', async () => {
    render(<Harness text={LONG_PAGE} skip />);
    await runTimers(100);

    expect(body()).toBe(LONG_PAGE);
    expect(complete()).toBe('true');
  });

  it('starts each new page from the beginning', async () => {
    const view = render(<Harness text={LONG_PAGE} />);
    await runTimers(LONG_PAGE.length * 30 + 500);

    const next = `${LONG_PAGE} And a second page, also long.`;
    view.rerender(<Harness text={next} />);
    await runTimers(next.length * 30 + 500);

    expect(body()).toBe(next);
    expect(complete()).toBe('true');
  });
});
