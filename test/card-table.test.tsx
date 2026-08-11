/**
 * Regression: reveals can land in the same batch. `UpdateRevealCard` used to
 * build the next array from the state variable, so a whole hand of reveals in
 * one tick each read the same stale array and only the last survived — the
 * rest stayed face down and the dialog never unlocked. Found in the browser
 * while landing #14; the ref is what makes the sequence additive.
 *
 * The reveal array is sized from the hand for the same class of reason: a
 * literal length is one that silently disagrees with `HAND_SIZE`, and a hand
 * with a seat the array does not have can never finish being turned over.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import CardTable, { planSpread } from '@/app/_components/CardTable';
import { CardType, HAND_SIZE } from '@/types';

const handOf = (size: number): CardType[] =>
  Array.from({ length: size }, (_, i) => ({
    id: i,
    image: `Tarot_0${i}.png`,
    name: `Card ${i}`,
  }));

const HAND = handOf(HAND_SIZE);

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

async function dealtTable(hand: CardType[] = HAND) {
  const setAllRevealed = vi.fn();
  const utils = render(
    <CardTable tarotHand={hand} setAllRevealed={setAllRevealed} />
  );
  // The deal is staggered and each card's timer is scheduled by the effect the
  // previous one triggered, so the chain only advances once per flushed act.
  for (let i = 0; i <= hand.length; i++) {
    await act(() => new Promise(r => setTimeout(r, 300)));
  }
  return { ...utils, setAllRevealed };
}

const card = (i: number) => document.getElementById(`t-card-${i}`);

describe('CardTable', () => {
  it('deals every card in the hand', async () => {
    await dealtTable();
    expect(document.querySelectorAll('[id^="background.t-card-"]').length).toBe(
      HAND_SIZE
    );
  });

  it('keeps every reveal when they land in one batch', async () => {
    const { setAllRevealed } = await dealtTable();

    act(() => {
      for (let i = 0; i < HAND_SIZE; i++) card(i)?.click();
    });

    expect(setAllRevealed).toHaveBeenCalledWith(true);
  });

  // The reveal array is built from the hand, so the table is not holding a
  // second opinion about how many cards there are. With a literal length, a
  // hand longer than it has a seat no reveal can reach: the last card turns,
  // `includes(false)` stays true, and the dialog never unlocks — the visitor
  // is stuck at the reveal prompt with every card face up.
  it.each([HAND_SIZE - 1, HAND_SIZE, HAND_SIZE + 1])(
    'reports a hand of %i revealed once every card is turned',
    async size => {
      const { setAllRevealed } = await dealtTable(handOf(size));

      act(() => {
        for (let i = 0; i < size; i++) card(i)?.click();
      });

      expect(setAllRevealed).toHaveBeenCalledWith(true);
    }
  );

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

  it('starts over when one hand replaces another of the same size', async () => {
    // The reset is keyed on the hand, not its size: a hand replaced by the same
    // number of other cards would otherwise stay dealt and face-up, and the
    // page would never hear that the new one had been revealed.
    const { rerender, setAllRevealed } = await dealtTable();
    act(() => {
      for (let i = 0; i < HAND_SIZE; i++) card(i)?.click();
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
      for (let i = 0; i < HAND_SIZE - 1; i++) card(i)?.click();
    });

    expect(setAllRevealed).not.toHaveBeenCalled();
  });
});
