/**
 * Regression: the reading dead-ended when the fortune returned in under 2.2s.
 * DialogBox schedules a REVEAL_MESSAGE placeholder 2200ms after the hand is
 * dealt, in the same effect that fires the mutation. If the mutation settled
 * first, that timer overwrote the whole reading with a one-element array and
 * the dialog rendered empty with an unlabeled button, unrecoverable.
 *
 * Mirrors the browser reproduction (test/mock-openai.mjs at MOCK_DELAY_MS=0).
 */
import React, { useState } from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CardType } from '@/types';
import {
  REVEAL_MESSAGE,
  RESET_MESSAGE,
} from '@/app/_components/DialogBox/data';

const READING = [
  'Past: paragraph one.',
  'Present: paragraph two.',
  'Future: paragraph three.',
].join('\n\n');

let fortuneDelayMs = 0;
let fortuneResult: string | undefined = READING;

vi.mock('../src/app/_trpc/client', () => ({
  trpc: {
    getFortune: {
      useMutation: (opts: { onSettled: (data: unknown) => void }) => {
        const [isPending, setIsPending] = useState(false);
        return {
          isPending,
          mutate: () => {
            setIsPending(true);
            setTimeout(() => {
              setIsPending(false);
              opts.onSettled(fortuneResult);
            }, fortuneDelayMs);
          },
        };
      },
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import DialogBox from '@/app/_components/DialogBox';

const HAND: CardType[] = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  image: `/card-${i}.png`,
  description: `card ${i}`,
  name: `Card ${i}`,
}));

function Harness({ tarotHand }: { tarotHand: CardType[] }) {
  const [stateIndex, setStateIndex] = useState(0);
  return (
    <DialogBox
      tarotHand={tarotHand}
      allRevealed
      fetchHand={false}
      setFetchHand={() => {}}
      resetData={() => {}}
      stateIndex={stateIndex}
      setStateIndex={setStateIndex}
    />
  );
}

const tick = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

/** Slices so the typewriter's chained promise/timer pairs get a chance to run. */
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
/** Second press runs the current state's action. */
const confirm = press;

const body = () =>
  document.querySelector('p.font-pixel')?.textContent ?? '';
const label = () => document.getElementById('dialogButton')?.textContent ?? '';

/** Mount, wait out the start state, press Draw Hand, then deal the hand. */
const dealHand = async () => {
  const view = render(<Harness tarotHand={[]} />);
  await tick(1200);
  await reveal();
  await confirm();
  view.rerender(<Harness tarotHand={HAND} />);
  await tick(0);
};

beforeEach(() => {
  vi.useFakeTimers();
  fortuneDelayMs = 0;
  fortuneResult = READING;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DialogBox fortune race', () => {
  it('keeps a reading that arrives before the 2200ms reveal timer', async () => {
    await dealHand();
    await tick(3000); // reading lands at 0ms, reveal timer fires at 2200ms

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

  it('shows the reveal placeholder while a slow reading is in flight', async () => {
    fortuneDelayMs = 4000;
    await dealHand();

    // Placeholder lands at 2200ms and types out while the fortune is in flight.
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

  it('still reaches the reset state when the fortune errors immediately', async () => {
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
});
