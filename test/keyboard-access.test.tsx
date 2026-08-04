/**
 * The arc, driven the way a keyboard visitor drives it (#18).
 *
 * "Press any key to continue" was a `keydown` on the window that answered every
 * key there is, with nothing on either page focused. That is convenient for a
 * sighted visitor with a mouse and a wall for everyone else: Tab is how you
 * reach the cards and the dialog's button, and answering it advanced the flow
 * out from under the visitor on every step. These pin the resolution — the
 * ambient path keeps every key except the ones spent getting around — and the
 * affordances that were missing underneath it.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isAnyKeyPress } from '@/app/_libs/keys';
import { BLOCKED_MESSAGE } from '@/app/_components/DialogBox/machine';
import { CardType } from '@/types';

const READING = ['Past.', 'Present.', 'Future.'].join('\n\n');

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
import CardTable from '@/app/_components/CardTable';

const HAND: CardType[] = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  image: `Tarot_0${i}.png`,
  name: `Card ${i}`,
}));

beforeEach(() => {
  vi.useFakeTimers();
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

afterEach(() => vi.useRealTimers());

const tick = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

const button = () => document.getElementById('dialogButton');
const body = () => document.querySelector('p.font-pixel')?.textContent ?? '';
const live = () => document.querySelector('p[aria-live="polite"]');
const alert = () => document.querySelector('p[role="alert"]');

/** Every key whose whole purpose is moving, rather than doing. */
const NAVIGATION = [
  'Tab',
  'Shift',
  'Escape',
  'Meta',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
];

describe('isAnyKeyPress', () => {
  it('answers an ordinary key', () => {
    expect(isAnyKeyPress({ key: 'x' } as KeyboardEvent)).toBe(true);
    expect(isAnyKeyPress({ key: 'Enter' } as KeyboardEvent)).toBe(true);
    // Space is a "press any key" in its own right; the Enter/Space-on-a-button
    // guard is what keeps it from stepping twice when a control holds focus.
    expect(isAnyKeyPress({ key: ' ' } as KeyboardEvent)).toBe(true);
  });

  it('leaves the keys a visitor navigates with alone', () => {
    for (const key of NAVIGATION)
      expect(isAnyKeyPress({ key } as KeyboardEvent)).toBe(false);
    expect(isAnyKeyPress({ key: 'r', metaKey: true } as KeyboardEvent)).toBe(
      false
    );
  });
});

describe('DialogBox, driven by keyboard', () => {
  const mount = () =>
    render(
      <DialogBox
        readingToken="t"
        allRevealed={false}
        onDraw={() => {}}
        onReset={() => {}}
      />
    );

  const keyPress = async () => {
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
  };

  /**
   * Stand at the reveal prompt with the page fully on screen and no card
   * turned — the one scene where an advance is refused.
   */
  const reachReveal = async () => {
    await tick(1200);
    await keyPress(); // skip the greeting's typewriter
    await keyPress(); // Draw Hand
    await tick(2400); // the reveal beat, and the reading landing
    await keyPress(); // skip the reveal prompt's typewriter
  };

  /**
   * The barrier this ticket exists for. Tabbing from card to card fired the
   * window's advance on every step, and at the reveal prompt each one was
   * refused — so moving between the cards shook the box and told the visitor
   * off for something they had not done yet.
   */
  it('does not advance on Tab, so the visitor can reach the cards', async () => {
    mount();
    await tick(1200);
    const before = body();

    await act(async () => {
      for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: 'Tab' });
      fireEvent.keyDown(window, { key: 'Shift' });
    });

    expect(body()).toBe(before);
    expect(document.body.textContent).not.toContain(BLOCKED_MESSAGE);
  });

  /**
   * The same barrier reached by a different key. The spread can stand taller
   * than the stage, so on a short viewport scrolling is the only way to see the
   * cards — and with focus on `<body>`, every scroll used to be read as an
   * advance and refused at the reveal prompt.
   */
  it('does not advance on the keys that scroll the page to the cards', async () => {
    mount();
    await reachReveal();
    const before = body();

    await act(async () => {
      for (const key of NAVIGATION) fireEvent.keyDown(window, { key });
    });

    expect(body()).toBe(before);
    expect(alert()).toBeNull();
    expect(document.body.textContent).not.toContain(BLOCKED_MESSAGE);
  });

  /**
   * The refusal is one message, so a repeat is identical text in an element
   * that never left the document — React writes nothing and no assistive path
   * fires. Keying it on the machine's nonce makes each refusal a fresh node.
   */
  it('announces every refused advance, not only the first', async () => {
    mount();
    await reachReveal();

    await keyPress();
    const first = alert();
    expect(first?.textContent).toBe(BLOCKED_MESSAGE);

    await keyPress();
    const second = alert();
    expect(second?.textContent).toBe(BLOCKED_MESSAGE);
    expect(second).not.toBe(first);
  });

  /**
   * Handing focus back is the whole of the job. `<body>` is also what holds
   * focus on first arrival, and taking it there cuts off the greeting the live
   * region is still announcing.
   */
  it('does not take focus on first arrival, while the greeting is announced', async () => {
    mount();
    await tick(1200);
    expect(live()?.textContent).toContain('Welcome to Pixel Fortune');

    // The greeting types itself out in full; nobody has pressed anything.
    await tick(30_000);

    expect(button()).not.toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  /** Enter on a card is the card's flip, not a step of the dialog. */
  it('leaves Enter to whichever button holds focus', async () => {
    mount();
    await tick(1200);
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' }); // skip the typewriter
    });
    const seen = body();

    const card = document.createElement('button');
    document.body.appendChild(card);
    await act(async () => {
      fireEvent.keyDown(card, { key: 'Enter' });
      fireEvent.keyDown(card, { key: ' ' });
    });

    expect(body()).toBe(seen);
    card.remove();
  });

  /**
   * The other half of the gate, and the twin of the case above: the same mount
   * from the same `<body>`, differing only in the visitor having pressed. The
   * button is unmounted while a page types and mounted again after, so every
   * press dropped focus to `<body>` and a keyboard visitor had to tab back in
   * at each paragraph.
   */
  it('hands focus back to the control once the visitor has pressed it', async () => {
    mount();
    await tick(1200);
    expect(button()).toBeNull();

    await keyPress();
    expect(document.activeElement).toBe(button());
  });

  /** The reading is announced a paragraph at a time, never a character. */
  it('announces the whole page, not the characters being typed', async () => {
    mount();
    await tick(1200);

    const region = live()!;
    expect(region.getAttribute('aria-atomic')).toBe('true');
    // Mid-typing, the visible copy is a prefix and the announcement is whole.
    await tick(90);
    expect(body().length).toBeLessThan(region.textContent!.length);
    expect(region.textContent).toContain('Welcome to Pixel Fortune');
    expect(
      document.querySelector('p.font-pixel')?.getAttribute('aria-hidden')
    ).toBe('true');
  });
});

describe('CardTable, announced', () => {
  it('says which card turned and how far through the spread that is', async () => {
    render(<CardTable tarotHand={HAND} setAllRevealed={() => {}} />);
    for (let i = 0; i < 6; i++) await tick(300);

    await act(async () => {
      document.getElementById('t-card-2')?.click();
    });

    const region = document.querySelector('p[aria-live="polite"]');
    expect(region?.textContent).toBe('Card 2. 1 of 5 cards revealed.');
  });
});
