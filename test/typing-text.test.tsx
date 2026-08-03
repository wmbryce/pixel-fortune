/**
 * Regression: a page longer than 1000 characters was silently lost.
 *
 * TypingText capped each page at `maxCharacters = 1000` against a `startIndex`
 * nothing advanced, so a long paragraph stopped typing at 1000 characters,
 * completion never fired, and the Continue button never appeared — the visitor
 * got less than was written, with nothing to say so.
 *
 * The ceiling is gone and the loop is one chain of timeouts per page rather
 * than an effect per character, so there is no longer a place for a page to
 * stop in. These pin the contract that replaced it: everything handed in is
 * typed, and completion is reported exactly once per page.
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
  const [done, setDone] = useState(0);
  return (
    <>
      <TypingText
        text={text}
        delay={0}
        skip={skip}
        onDone={() => setDone(n => n + 1)}
      />
      <span data-testid="done">{String(done)}</span>
    </>
  );
}

/** Slices so the typewriter's chained timeouts get a chance to run. */
const runTimers = async (ms: number, slice = 30) => {
  for (let t = 0; t < ms; t += slice) {
    await act(async () => {
      vi.advanceTimersByTime(slice);
    });
  }
};

const body = () => document.querySelector('p.font-pixel')?.textContent ?? '';
const done = () => document.querySelector('[data-testid="done"]')?.textContent;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('TypingText', () => {
  it('types out a page longer than the old 1000-character ceiling', async () => {
    expect(LONG_PAGE.length).toBeGreaterThan(1000);
    render(<Harness text={LONG_PAGE} />);

    // 30ms per character, plus slack for the leading delay.
    await runTimers(LONG_PAGE.length * 30 + 500);

    expect(body()).toBe(LONG_PAGE);
    expect(done()).toBe('1');
  });

  it('reveals a long page in full when the visitor skips', async () => {
    render(<Harness text={LONG_PAGE} skip />);
    await runTimers(100);

    expect(body()).toBe(LONG_PAGE);
    expect(done()).toBe('1');
  });

  it('starts each new page from the beginning', async () => {
    const view = render(<Harness text={LONG_PAGE} />);
    await runTimers(LONG_PAGE.length * 30 + 500);

    const next = `${LONG_PAGE} And a second page, also long.`;
    view.rerender(<Harness text={next} skip={false} />);
    // A page that starts where the last one stopped would already read as
    // complete here; it has to type the tail out.
    expect(body()).toBe('');

    await runTimers(next.length * 30 + 500);
    expect(body()).toBe(next);
    expect(done()).toBe('2');
  });

  it('reports completion once, not once a frame', async () => {
    render(<Harness text="Short." />);
    await runTimers(1000);

    expect(body()).toBe('Short.');
    expect(done()).toBe('1');
  });
});
