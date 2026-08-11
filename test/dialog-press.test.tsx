/**
 * "Press once to finish the message, press again to move on" — by mouse and by
 * touch, not only by key.
 *
 * The machine has always had the two-step (`machine.ts`: an advance with
 * `typed` false fills the page in and moves nothing). What it did not have was
 * a way for a hand to reach it. The only click path was the Continue button's
 * own `onClick`, and that button is mounted on `page && state.typed` — exactly
 * when there is nothing left to skip. So while the typewriter ran there was no
 * click target in the document at all: a mouse could not finish a message, and
 * a phone, which has no ambient `keydown` either, could do nothing but wait
 * every page out to the end.
 *
 * These are the properties of the fix. The one that is easiest to undo by
 * accident is the last: a tap is a synthesised click, so a `touchstart`
 * listener beside the click one would make a single finger both skip and
 * advance.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { REVEAL_MESSAGE } from '@/app/_components/DialogBox/data';
import { BLOCKED_MESSAGE } from '@/app/_components/DialogBox/machine';

const READING = [
  'Past: paragraph one.',
  'Present: paragraph two.',
  'Future: paragraph three.',
].join('\n\n');

vi.mock('../src/app/_trpc/client', () => ({
  trpc: {
    getFortune: {
      useMutation: (opts: { onSettled: (data: unknown) => void }) => ({
        mutate: () => setTimeout(() => opts.onSettled(READING), 0),
      }),
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

import DialogBox from '@/app/_components/DialogBox';

function Harness({
  token = '',
  allRevealed = true,
}: {
  token?: string;
  allRevealed?: boolean;
}) {
  return (
    <>
      {/* Stands in for a card: a control outside the dialog's subtree, which a
          press surface on the box must never answer for. */}
      <button id="outsider" type="button">
        a card
      </button>
      <DialogBox
        readingToken={token}
        allRevealed={allRevealed}
        onDraw={() => {}}
        onReset={() => {}}
      />
    </>
  );
}

const tick = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

/** Slices so the typewriter's chained timeouts get a chance to run. */
const runTimers = async (ms: number, slice = 30) => {
  for (let t = 0; t < ms; t += slice) await tick(slice);
};

const body = () => document.querySelector('p.font-pixel')?.textContent ?? '';
const button = () => document.getElementById('dialogButton');
/** The box itself — the surface the press now lands on. */
const surface = () =>
  document.querySelector('.border-brown_01') as HTMLElement | null;

const clickOn = async (el: Element | null) => {
  await act(async () => {
    fireEvent.click(el!);
  });
};

/** A finger: the touch pair a browser sends, then the click it synthesises. */
const tap = async (el: Element | null) => {
  await act(async () => {
    fireEvent.touchStart(el!);
    fireEvent.touchEnd(el!);
    fireEvent.click(el!);
  });
};

const keyPress = async () => {
  await act(async () => {
    fireEvent.keyDown(window, { key: 'Enter' });
  });
};

/**
 * Mount and walk to the reveal prompt, stopping while it is still typing. The
 * prompt is the longest page in the app, so it is where waiting it out hurts
 * most and where the skip has the most to prove.
 */
const toRevealMidType = async (allRevealed = true) => {
  const view = render(<Harness allRevealed={allRevealed} />);
  await tick(1200); // the box wakes and starts the greeting
  await keyPress(); // fill the greeting in
  await keyPress(); // draw the hand
  view.rerender(<Harness token="test-token" allRevealed={allRevealed} />);
  await runTimers(2400); // the reading lands, then the 2200ms reveal beat
  await runTimers(1800); // the lead-in, plus a few characters
  return view;
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pressing the dialog', () => {
  it('has a click target while the message is still typing', async () => {
    await toRevealMidType();

    // The bug, stated as the property that failed: the button is the only
    // thing that used to answer a click, and it is not here yet.
    expect(button()).toBeNull();
    expect(surface()).not.toBeNull();
  });

  it('finishes the message on a click, and advances on the next', async () => {
    await toRevealMidType();

    const partial = body();
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan(REVEAL_MESSAGE.length);

    await clickOn(surface());
    // One press: the whole message, and still the same page.
    expect(body()).toBe(REVEAL_MESSAGE);
    expect(button()).not.toBeNull();

    await clickOn(surface());
    await runTimers(3200);
    expect(body()).toContain('paragraph one');
  });

  it('finishes the message on a tap, and advances on the next', async () => {
    await toRevealMidType();
    expect(body().length).toBeLessThan(REVEAL_MESSAGE.length);

    await tap(surface());
    // The half a phone could never reach: one finger fills the page in and
    // does *not* also advance, which is what a `touchstart` listener beside
    // the click one would cost.
    expect(body()).toBe(REVEAL_MESSAGE);

    await tap(surface());
    await runTimers(3200);
    expect(body()).toContain('paragraph one');
  });

  it('counts a press on the button once, not once per handler', async () => {
    await toRevealMidType();
    await clickOn(surface()); // fill the prompt in, mounting the button

    // The button's own `onClick` answers this; the surface's handler must not
    // answer it as well, or one press would skip a whole paragraph.
    await clickOn(button());
    await runTimers(3200);
    expect(body()).toContain('paragraph one');

    await clickOn(button());
    await runTimers(3200);
    expect(body()).toContain('paragraph two');
  });

  it('never answers a press aimed at a control outside the box', async () => {
    await toRevealMidType();
    const partial = body();

    await tap(document.getElementById('outsider'));

    // A card turning over is not an advance, and the surface is scoped to the
    // dialog precisely so a global listener cannot swallow that tap.
    expect(body()).toBe(partial);
  });

  it('still refuses to advance past the reveal with a card face down', async () => {
    await toRevealMidType(false);

    await clickOn(surface()); // fills the prompt in — always allowed
    expect(body()).toBe(REVEAL_MESSAGE);

    await clickOn(surface()); // the advance the guard exists to refuse
    await runTimers(500);
    expect(body()).toBe(REVEAL_MESSAGE);
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      BLOCKED_MESSAGE
    );
  });
});
