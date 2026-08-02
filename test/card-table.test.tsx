/**
 * Regression: reveals can land in the same batch. `UpdateRevealCard` used to
 * build the next array from the state variable, so five reveals in one tick
 * each read the same stale array and only the last survived — four cards
 * stayed face down and the dialog never unlocked. Found in the browser while
 * landing #14; the ref is what makes the sequence additive.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import CardTable, { planSpread } from '@/app/_components/CardTable';
import { CardType } from '@/types';

const HAND: CardType[] = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  image: `Tarot_0${i}.png`,
  description: '',
  name: `Card ${i}`,
}));

/** jsdom has no layout, so the stage reports whatever box a test sets. */
const PHONE = { width: 390, height: 520 };
let stageBox = PHONE;

beforeEach(() => {
  stageBox = PHONE;
});

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
          [{ contentRect: stageBox } as ResizeObserverEntry],
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

  it('reserves a plan the stage is too short for', async () => {
    // A landscape phone leaves a 66px stage. The plan is taller than that, and
    // centring it there put the cards above the header and over the dialog box
    // with nothing to scroll them back — the stage reserves its height instead.
    stageBox = { width: 844, height: 66 };
    const { container } = await dealtTable();

    const plan = planSpread(844, 66);
    expect(plan.height).toBeGreaterThan(66);
    expect((container.firstChild as HTMLElement).style.minHeight).toBe(
      `${plan.height}px`
    );
  });

  it('starts over when one five-card hand replaces another', async () => {
    // The reset is keyed on the hand, not its size: a five-card hand replaced
    // by five other cards would otherwise stay dealt and face-up, and the page
    // would never hear that the new one had been revealed.
    const { rerender, setAllRevealed } = await dealtTable();
    act(() => {
      for (let i = 0; i < 5; i++) card(i)?.click();
    });

    const next = HAND.map(c => ({ ...c, name: `${c.name} again` }));
    rerender(<CardTable tarotHand={next} setAllRevealed={setAllRevealed} />);

    expect(document.querySelectorAll('[id^="background.t-card-"]').length).toBe(
      0
    );
  });

  it('does not report the hand revealed while a card is still down', async () => {
    const { setAllRevealed } = await dealtTable();

    act(() => {
      for (let i = 0; i < 4; i++) card(i)?.click();
    });

    expect(setAllRevealed).not.toHaveBeenCalled();
  });
});
