/**
 * Reduced motion is a cross-fade, not a disable (#15, per `/apple-design`). The
 * failure this guards against is the tempting one: gating the animation off and
 * leaving a visitor who set the preference unable to tell that their tap did
 * anything.
 *
 * `motion` reads the preference once, lazily, on the first `useReducedMotion`
 * anywhere in the module graph — so the stub has to be in place before the
 * first render in this file, and this file cannot be merged into one that
 * renders under the default.
 */
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { mediaQueryList } from './setup';
import { CardType } from '@/types';
import { DIM } from '@/app/_libs/motion';

// A pointer device that has asked for reduced motion: the case where both
// pointer states have to answer with something other than travel.
vi.stubGlobal('matchMedia', (query: string) =>
  mediaQueryList(
    query,
    query.includes('prefers-reduced-motion') || query.includes('hover: hover')
  )
);

import Card from '@/app/_components/Card';
import CardTable from '@/app/_components/CardTable';

const DATA: CardType = {
  id: 0,
  name: 'The Fool',
  image: 'Tarot_00_Fool.png',
};

const HAND: CardType[] = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  image: `Tarot_0${i}.png`,
  name: `Card ${i}`,
}));

const STAGE = { width: 390, height: 520 };

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
          [{ contentRect: STAGE } as ResizeObserverEntry],
          this as unknown as ResizeObserver
        );
      }
      disconnect() {}
      unobserve() {}
    }
  );
});

/** The table's animated wrapper around each card. */
const seats = () =>
  Array.from(document.querySelectorAll('[id^="background.t-card-"]')).map(
    el => el.parentElement as HTMLElement
  );

const flipper = () => document.getElementById('t-card-0') as HTMLElement;
const back = () => document.getElementById('back.t-card-0') as HTMLElement;

const card = (reveal: boolean) => (
  <Card
    id="t-card-0"
    index={0}
    width={96}
    data={DATA}
    reveal={reveal}
    setReveal={vi.fn()}
  />
);

describe('Card under prefers-reduced-motion', () => {
  it('reveals by fading the back off rather than turning the card', async () => {
    const { rerender } = render(card(false));
    expect(back().style.opacity).not.toBe('0');

    rerender(card(true));

    await vi.waitFor(() => expect(back().style.opacity).toBe('0'));
    // The rotation is the travel the preference asks us to drop, and the
    // scale/z lift is derived from it, so both stay put.
    expect(flipper().style.transform ?? '').not.toMatch(/rotateY\(1?[1-9]/);
  });

  it('shows the front face from the start, since nothing turns it round', () => {
    render(card(false));
    const front = back().parentElement?.firstElementChild as HTMLElement;
    expect(front.style.transform).toBe('');
    expect(front.style.backfaceVisibility).toBe('');
  });

  /**
   * The ticket's core deliverable, and the one the tempting failure takes away:
   * a press that moves nothing and dims nothing is a press the visitor cannot
   * tell landed. Deleting the reduced branch of `whileTap` leaves everything
   * else in this file green.
   */
  it('answers a press with a dim, since it may not answer with a lift', async () => {
    render(card(false));
    fireEvent.pointerDown(flipper(), { isPrimary: true, button: 0 });

    await vi.waitFor(() =>
      expect(flipper().style.opacity).toBe(String(DIM.press))
    );
    expect(flipper().style.transform ?? '').not.toMatch(/translateY\(-[\d.]/);
  });

  it('answers a hover the same way, rather than not at all', async () => {
    render(card(false));
    fireEvent.pointerEnter(flipper(), { isPrimary: true });

    await vi.waitFor(() =>
      expect(flipper().style.opacity).toBe(String(DIM.hover))
    );
    expect(flipper().style.transform ?? '').not.toMatch(/translateY\(-[\d.]/);
  });
});

describe('CardTable under prefers-reduced-motion', () => {
  it('deals each card into its seat instead of across the stage', async () => {
    render(<CardTable tarotHand={HAND} setAllRevealed={vi.fn()} />);
    // Sampled a beat after the first card mounts, while a fan would still be
    // mid-flight: the fan starts a card at `-box.h` and rotated out of true, so
    // both are off-stage travel and neither may happen here.
    await act(() => new Promise(r => setTimeout(r, 300)));
    const first = seats()[0];
    const y = /translateY\((-?[\d.]+)px\)/.exec(first.style.transform);
    expect(Number(y?.[1] ?? 0)).toBeGreaterThanOrEqual(0);
    expect(first.style.transform).not.toMatch(/rotate\(-?[1-9]/);

    for (let i = 0; i < 5; i++) {
      await act(() => new Promise(r => setTimeout(r, 300)));
    }
    expect(seats().length).toBe(5);
    // The arrival is still announced — it is carried by opacity now.
    await vi.waitFor(() =>
      seats().forEach(seat => expect(seat.style.opacity).toBe('1'))
    );
  });
});
