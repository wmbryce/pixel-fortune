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
import { reloadSettings, updateSettings } from '@/app/_libs/settings';

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

beforeEach(() => {
  window.localStorage.clear();
  reloadSettings();
  vi.useFakeTimers();
});
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

  /**
   * The settings modal sits in the tarot header, so a pace change while a page
   * is typing is a first-class path. A change must pick up where the visitor
   * is — never collapse the paragraph back to one character, and never spend
   * the page's lead-in a second time.
   */
  it('resumes from the current position on a mid-page speed change', async () => {
    const TEXT = 'A reading, paced by the visitor, changing pace mid-page.';
    const onDone = vi.fn();
    render(
      <TypingText text={TEXT} delay={1000} skip={false} onDone={onDone} />
    );

    // Through the lead-in and partway into the page at 30ms a character.
    await runTimers(1000 + 300);
    const typed = body().length;
    expect(typed).toBeGreaterThan(0);
    expect(typed).toBeLessThan(TEXT.length);

    await act(async () => updateSettings({ textSpeed: 'fast' }));
    expect(body().length).toBe(typed);

    // 60ms is five characters at the fast pace: a restart from character one
    // would read shorter than `typed` here, and a re-waited 1000ms lead-in
    // would read exactly `typed`. Only a resume grows past it.
    await runTimers(60, 12);
    expect(body().length).toBeGreaterThan(typed);
    expect(body()).toBe(TEXT.slice(0, body().length));

    await runTimers((TEXT.length - typed) * 12 + 200, 12);
    expect(body()).toBe(TEXT);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps an instant page painted when speed returns to normal', async () => {
    updateSettings({ textSpeed: 'instant' });
    const TEXT = 'A page painted whole, then the setting is put back.';
    const onDone = vi.fn();
    render(
      <TypingText text={TEXT} delay={1000} skip={false} onDone={onDone} />
    );
    await act(async () => {});
    expect(body()).toBe(TEXT);
    expect(onDone).toHaveBeenCalledTimes(1);

    await act(async () => updateSettings({ textSpeed: 'normal' }));
    expect(body()).toBe(TEXT);

    await runTimers(2000);
    expect(body()).toBe(TEXT);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
