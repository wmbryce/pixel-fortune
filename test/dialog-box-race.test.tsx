/**
 * The dialog driven end to end through React, against the three bugs that came
 * out of the old `stateIndex`-into-a-rewritten-array shape.
 *
 * The reading arriving early used to overwrite the whole array from a 2200ms
 * placeholder timer, dead-ending the visitor with an unlabelled button. The
 * machine (`DialogBox/machine.ts`) cannot express that any more — an arrival
 * fills a slot the scene never lives in — and `test/dialog-machine.test.ts`
 * pins that at the seam. These are the same journeys walked through the
 * component, so the wiring is covered too.
 *
 * Mirrors the browser reproduction (test/mock-openai.mjs at MOCK_DELAY_MS=0).
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  REVEAL_MESSAGE,
  RESET_MESSAGE,
  WELCOME_MESSAGE,
} from '@/app/_components/DialogBox/data';

const READING = [
  'Past: paragraph one.',
  'Present: paragraph two.',
  'Future: paragraph three.',
].join('\n\n');

let fortuneDelayMs = 0;
let fortuneResult: string | undefined = READING;
let fortuneCalls = 0;

vi.mock('../src/app/_trpc/client', () => ({
  trpc: {
    getFortune: {
      useMutation: (opts: { onSettled: (data: unknown) => void }) => ({
        mutate: () => {
          fortuneCalls += 1;
          setTimeout(() => opts.onSettled(fortuneResult), fortuneDelayMs);
        },
      }),
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

import DialogBox from '@/app/_components/DialogBox';

let drawn = 0;
let resets = 0;

/** Stands in for `tarot/page.tsx`: a draw eventually answers with a token. */
function Harness({ token = '' }: { token?: string }) {
  return (
    <DialogBox
      readingToken={token}
      allRevealed
      onDraw={() => {
        drawn += 1;
      }}
      onReset={() => {
        resets += 1;
      }}
    />
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

const press = async () => {
  await act(async () => {
    fireEvent.keyDown(window, { key: 'Enter' });
  });
};

/** First press skips the typewriter so the body renders in full. */
const reveal = press;
/** Second press runs the current scene's transition. */
const confirm = press;

const body = () => document.querySelector('p.font-pixel')?.textContent ?? '';
const button = () => document.getElementById('dialogButton');
const label = () => button()?.textContent ?? '';

/** Mount, wait out the opening beat, press Draw Hand, then land the hand. */
const dealHand = async () => {
  const view = render(<Harness />);
  await tick(1200);
  await reveal();
  await confirm();
  view.rerender(<Harness token="test-token" />);
  await tick(0);
  return view;
};

beforeEach(() => {
  vi.useFakeTimers();
  fortuneDelayMs = 0;
  fortuneResult = READING;
  fortuneCalls = 0;
  drawn = 0;
  resets = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DialogBox', () => {
  it('keeps a reading that arrives before the 2200ms reveal beat', async () => {
    await dealHand();
    await tick(3000); // reading lands at 0ms, the beat fires at 2200ms

    await reveal();
    expect(body()).toContain(REVEAL_MESSAGE.slice(0, 40));
    expect(label()).toBe('Continue');

    await confirm();
    await reveal();
    expect(body()).toContain('paragraph one');

    await confirm();
    await reveal();
    expect(body()).toContain('paragraph two');

    await confirm();
    await reveal();
    expect(body()).toContain('paragraph three');

    await confirm();
    await reveal();
    expect(body()).toContain(RESET_MESSAGE.slice(0, 40));
    expect(label()).toBe('Complete');
  });

  it('shows the reveal prompt while a slow reading is in flight', async () => {
    fortuneDelayMs = 4000;
    await dealHand();

    // The prompt lands on the beat and types out while the fortune is in
    // flight; the control reads as busy until the reading is actually there.
    await runTimers(3900);
    expect(body().length).toBeGreaterThan(0);
    expect(REVEAL_MESSAGE.startsWith(body())).toBe(true);

    await tick(200); // reading lands at 4000ms

    await reveal();
    expect(body()).toContain(REVEAL_MESSAGE.slice(0, 40));

    await confirm();
    await reveal();
    expect(body()).toContain('paragraph one');

    await confirm();
    await reveal();
    expect(body()).toContain('paragraph two');

    await confirm();
    await reveal();
    expect(body()).toContain('paragraph three');

    await confirm();
    await reveal();
    expect(label()).toBe('Complete');
  });

  it('holds at the reveal prompt rather than paging past a reading that has not arrived', async () => {
    fortuneDelayMs = 60_000;
    await dealHand();
    await runTimers(2400);

    await reveal();
    expect(label()).toBe('loading');

    // Every press here used to walk `stateIndex` off the end of a one-element
    // array: an empty box with an unlabelled button and no way back.
    for (let i = 0; i < 5; i++) await confirm();
    expect(body()).toContain(REVEAL_MESSAGE.slice(0, 40));
    expect(label()).toBe('loading');

    await tick(60_000);
    expect(label()).toBe('Continue');
    await confirm();
    await reveal();
    expect(body()).toContain('paragraph one');
  });

  it('pages a paragraph past the old 1000-character ceiling in full', async () => {
    const long = Array.from(
      { length: 30 },
      (_, i) => `Sentence ${i} of a reading that runs long enough to matter.`
    ).join(' ');
    fortuneResult = [long, 'Second paragraph.'].join('\n\n');
    expect(long.length).toBeGreaterThan(1000);

    await dealHand();
    await tick(3000);

    await reveal();
    await confirm();
    // No skip: the page has to finish typing on its own, which is what used to
    // stall at 1000 characters and leave the dialog with no button.
    await runTimers(long.length * 40 + 1000);
    expect(body()).toBe(long);
    expect(label()).toBe('Continue');

    await confirm();
    await reveal();
    expect(body()).toContain('Second paragraph.');
  });

  it('still reaches the reset scene when the fortune errors immediately', async () => {
    fortuneResult = undefined;
    await dealHand();
    await tick(3000);

    await reveal();
    expect(body()).toContain(REVEAL_MESSAGE.slice(0, 40));

    await confirm();
    await reveal();
    expect(body()).toContain(RESET_MESSAGE.slice(0, 40));
    expect(label()).toBe('Complete');
  });

  it('survives a burst of keypresses through the reset', async () => {
    await dealHand();
    await tick(3000);

    // Machine-fast: no render between them, which is the shape that was
    // reported as an unreproducible reset failure during #15.
    await act(async () => {
      for (let i = 0; i < 40; i++) fireEvent.keyDown(window, { key: 'Enter' });
    });
    await runTimers(600);

    expect(resets).toBe(1);
    // The farewell stays on screen through the exit rather than blanking, and
    // nothing walks past it.
    expect(RESET_MESSAGE.startsWith(body())).toBe(true);
    expect(label()).toBe('Complete');
    expect(body()).not.toContain(WELCOME_MESSAGE.slice(0, 40));
  });

  it('deals one hand and buys one reading, however hard the key is pressed', async () => {
    const view = render(<Harness />);
    await tick(1200);
    await act(async () => {
      for (let i = 0; i < 20; i++) fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(drawn).toBe(1);

    view.rerender(<Harness token="test-token" />);
    await tick(0);
    view.rerender(<Harness token="test-token" />);
    await tick(3000);
    expect(fortuneCalls).toBe(1);
  });
});
