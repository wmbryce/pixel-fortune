/**
 * Regression: reveals can land in the same batch. `UpdateRevealCard` used to
 * build the next array from the state variable, so five reveals in one tick
 * each read the same stale array and only the last survived — four cards
 * stayed face down and the dialog never unlocked. Found in the browser while
 * landing #14; the ref is what makes the sequence additive.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import CardTable from '@/app/_components/CardTable';
import { CardType } from '@/types';

const HAND: CardType[] = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  image: `Tarot_0${i}.png`,
  description: '',
  name: `Card ${i}`,
}));

/** jsdom has no layout, so the stage reports a phone-sized box. */
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe() {
        this.cb(
          [{ contentRect: { width: 390, height: 520 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver
        );
      }
      disconnect() {}
      unobserve() {}
    }
  );
});

async function dealtTable() {
  const setAllRevealed = vi.fn();
  const utils = render(
    <CardTable tarotHand={HAND} setAllRevealed={setAllRevealed} />
  );
  // The deal is staggered and each card's timer is scheduled by the effect the
  // previous one triggered, so the chain only advances once per flushed act.
  for (let i = 0; i < 6; i++) {
    await act(() => new Promise(r => setTimeout(r, 300)));
  }
  return { ...utils, setAllRevealed };
}

const card = (i: number) => document.getElementById(`t-card-${i}`);

describe('CardTable', () => {
  it('deals every card in the hand', async () => {
    await dealtTable();
    expect(document.querySelectorAll('[id^="background.t-card-"]').length).toBe(
      5
    );
  });

  it('keeps every reveal when they land in one batch', async () => {
    const { setAllRevealed } = await dealtTable();

    act(() => {
      for (let i = 0; i < 5; i++) card(i)?.click();
    });

    expect(setAllRevealed).toHaveBeenCalledWith(true);
  });

  it('does not report the hand revealed while a card is still down', async () => {
    const { setAllRevealed } = await dealtTable();

    act(() => {
      for (let i = 0; i < 4; i++) card(i)?.click();
    });

    expect(setAllRevealed).not.toHaveBeenCalled();
  });
});
