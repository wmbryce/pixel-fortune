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

/** How long the reading takes to land, so a spec can stand inside the wait. */
const server = vi.hoisted(() => ({ delay: 0 }));

vi.mock('../src/app/_trpc/client', () => ({
  trpc: {
    getFortune: {
      useMutation: (opts: { onSettled: (data: unknown) => void }) => ({
        mutate: () => setTimeout(() => opts.onSettled(READING), server.delay),
      }),
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

import DialogBox, {
  ARRIVED_AND_PRESSABLE_MESSAGE,
  ARRIVED_MESSAGE,
  PRESSABLE_MESSAGE,
  WAITING_MESSAGE,
} from '@/app/_components/DialogBox';
import CardTable from '@/app/_components/CardTable';

const HAND: CardType[] = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  image: `Tarot_0${i}.png`,
  name: `Card ${i}`,
}));

beforeEach(() => {
  server.delay = 0;
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
const status = () => document.querySelector('p[role="status"]');
/**
 * The control the "press continue" instruction names, found by its own name
 * rather than by id: `AnimatePresence` keeps the page it is leaving mounted
 * while the exit plays, so the id can still answer with the previous page's.
 */
const continueButton = () =>
  Array.from(document.querySelectorAll('button')).find(
    element => element.textContent === 'Continue'
  );

/**
 * Every key that moves rather than does, in the only context this filter ever
 * sees: a window listener, with `<body>` holding focus. Space is here because
 * from `<body>` it is the page's scroll key and nothing else — on a focused
 * control it is still an activation, and the browser's own synthesised click is
 * what carries it there.
 */
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
  ' ',
];

describe('isAnyKeyPress', () => {
  it('answers an ordinary key', () => {
    expect(isAnyKeyPress({ key: 'x' } as KeyboardEvent)).toBe(true);
    // Enter is not a scroll key at `<body>` level, so it stays ambient.
    expect(isAnyKeyPress({ key: 'Enter' } as KeyboardEvent)).toBe(true);
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
  const mount = (allRevealed = false) =>
    render(
      <DialogBox
        readingToken="t"
        allRevealed={allRevealed}
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
   * Space is split by focus context rather than kept or dropped whole. From
   * `<body>` — which is the only context this window listener ever sees — it is
   * the page's scroll key, the same failure the arrows and PageDown close, and
   * the ambient path must not answer it. On a focused control it is unchanged,
   * because the browser answers it with a click of the button's own and that
   * click is what reaches the dialog. jsdom synthesises no such click, so the
   * click itself is what stands in for it here.
   */
  it('leaves Space to scroll the page, and still answers the focused control', async () => {
    mount();
    await tick(1200);
    await keyPress(); // fill the greeting in, so the control is on screen
    const greeting = body();
    expect(greeting).not.toBe('');

    await act(async () => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(body()).toBe(greeting);

    await act(async () => {
      button()?.click();
    });
    // One step, and only one: the greeting has left and the hand is being dealt.
    expect(body()).toBe('');
  });

  /**
   * The reveal prompt with every card turned and the reading still coming is
   * the one press the machine neither takes nor refuses: it returns the
   * identical state, so nothing re-renders and nothing is said, and the button
   * goes from `loading` to `Continue` on its own some seconds later with no
   * announcement either. Both halves belong to the component — the machine is
   * right that neither is a move — so both are said from a polite region that
   * carries status and never the reading.
   */
  it('says the reading is still coming, and says when it lands', async () => {
    server.delay = 10_000;
    mount(true);
    await tick(1200);
    await keyPress(); // fill the greeting in
    await keyPress(); // Draw Hand
    await tick(2400); // the reveal beat; the reading is still in flight
    await keyPress(); // fill the reveal prompt in

    expect(button()?.getAttribute('aria-busy')).toBe('true');
    expect(status()?.textContent).toBe('');

    await keyPress();
    expect(status()?.textContent).toBe(WAITING_MESSAGE);
    // Nothing was refused — the cards are all turned. This is a wait, not a no.
    expect(alert()).toBeNull();

    // The button is already mounted and every card is up, so the reading
    // landing makes both facts true at once — one announcement, not two.
    await tick(10_000);
    expect(status()?.textContent).toBe(ARRIVED_AND_PRESSABLE_MESSAGE);
    expect(button()?.getAttribute('aria-busy')).toBe('false');
  });

  /**
   * The reading routinely lands while the reveal prompt is still typing — it is
   * ~400 characters at 30ms each behind a 1600ms lead-in, and a reading is back
   * in a few seconds. The Continue button does not exist until the page is
   * fully on screen, so an announcement naming it would send a screen-reader
   * visitor to a control that is not in the document.
   */
  it('states that the reading arrived without naming a control that is absent', async () => {
    server.delay = 3000;
    mount(true);
    await tick(1200);
    await keyPress(); // fill the greeting in
    await keyPress(); // Draw Hand
    await tick(2400); // the reveal beat; the prompt starts typing
    await tick(1000); // the reading lands, mid lead-in

    // The control the instruction would name is not in the document: the page
    // is still typing, so the reveal's Continue has not mounted.
    expect(continueButton()).toBeUndefined();
    expect(status()?.textContent).toBe(ARRIVED_MESSAGE);
  });

  /**
   * The other way the old copy lied: the visitor is normally still turning
   * cards when the reading lands, and a press with a card face down is refused
   * — the exact blame this ticket exists to stop. So the arrival is stated, and
   * the instruction waits until the press would actually be taken.
   */
  it('holds the instruction until the press would be taken, then gives it once', async () => {
    server.delay = 10_000;
    const view = mount(false);
    await tick(1200);
    await keyPress(); // fill the greeting in
    await keyPress(); // Draw Hand
    await tick(2400); // the reveal beat
    await keyPress(); // fill the reveal prompt in, so the button is mounted

    await tick(10_000);
    expect(continueButton()).toBeDefined();
    expect(status()?.textContent).toBe(ARRIVED_MESSAGE);

    await act(async () => {
      view.rerender(
        <DialogBox
          readingToken="t"
          allRevealed={true}
          onDraw={() => {}}
          onReset={() => {}}
        />
      );
    });
    expect(status()?.textContent).toBe(PRESSABLE_MESSAGE);

    // Once. A re-render that changes nothing must not be a second telling — an
    // announcement is a transition, not a state read out on every commit.
    const said = status()?.firstElementChild;
    await act(async () => {
      view.rerender(
        <DialogBox
          readingToken="t"
          allRevealed={true}
          onDraw={() => {}}
          onReset={() => {}}
        />
      );
    });
    expect(status()?.firstElementChild).toBe(said);
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
