/**
 * The dialog's state machine at its seam. `dialogReducer` is pure, so the three
 * bugs that came out of the old `stateIndex`-into-a-rewritten-array shape can
 * be stated here as properties rather than reproduced as timings:
 *
 *  1. no ordering of `reading` against the beat can move or blank the scene;
 *  2. a scene carries its own text, so nothing can point past the end of a
 *     reading — the shape that let the typewriter stall with no way forward;
 *  3. `leaving` accepts nothing, so a keypress burst through the reset has
 *     nowhere to go.
 *
 * Component-level journeys for the same three are in `dialog-box-race.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import {
  BLOCKED_MESSAGE,
  INITIAL,
  dialogReducer as reduce,
  leadIn,
  pageOf,
  splitReading,
  type DialogEvent,
  type DialogState,
} from '@/app/_components/DialogBox/machine';
import {
  RESET_MESSAGE,
  REVEAL_MESSAGE,
  WELCOME_MESSAGE,
} from '@/app/_components/DialogBox/data';

const PASSAGES = ['one.', 'two.', 'three.'];

const run = (state: DialogState, ...events: DialogEvent[]) =>
  events.reduce(reduce, state);

/** Two presses per page: the first fills it in, the second leaves it. */
const page = (allRevealed = true): DialogEvent[] => [
  { type: 'advance', allRevealed },
  { type: 'advance', allRevealed },
];

const dealt = run(INITIAL, { type: 'wake' }, ...page(), { type: 'prompt' });

describe('scene', () => {
  it('says nothing until the opening beat, then offers the draw', () => {
    expect(pageOf(INITIAL.scene)).toBeNull();
    const woken = reduce(INITIAL, { type: 'wake' });
    expect(pageOf(woken.scene)?.body).toBe(WELCOME_MESSAGE);
    expect(pageOf(woken.scene)?.label).toBe('Draw Hand');
  });

  it('goes quiet again while the hand is dealt', () => {
    const drawing = run(INITIAL, { type: 'wake' }, ...page());
    expect(drawing.scene.name).toBe('dealing');
    expect(pageOf(drawing.scene)).toBeNull();
    expect(drawing.reading.status).toBe('pending');
  });

  it('asks for the cards on the beat, and only on the beat', () => {
    expect(dealt.scene.name).toBe('reveal');
    expect(pageOf(dealt.scene)?.body).toBe(REVEAL_MESSAGE);
  });

  it('walks the reading a paragraph at a time, then the farewell', () => {
    let state = run(dealt, { type: 'reading', passages: PASSAGES });
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      state = run(state, ...page());
      seen.push(pageOf(state.scene)?.body ?? '');
    }
    expect(seen).toEqual([...PASSAGES, RESET_MESSAGE]);
    expect(pageOf(state.scene)?.label).toBe('Complete');
  });

  it('gives the two pages that open an act the long lead-in', () => {
    const reading = run(dealt, { type: 'reading', passages: PASSAGES });
    const first = run(reading, ...page());
    const second = run(first, ...page());
    expect(leadIn(reading.scene)).toBe(1600);
    expect(leadIn(first.scene)).toBe(1600);
    expect(leadIn(second.scene)).toBe(200);
  });
});

describe('a reading arriving', () => {
  it('never moves the scene, whenever it lands', () => {
    const before = run(INITIAL, { type: 'wake' }, ...page());
    for (const at of [before, dealt]) {
      const after = reduce(at, { type: 'reading', passages: PASSAGES });
      expect(after.scene).toBe(at.scene);
      expect(after.typed).toBe(at.typed);
    }
  });

  it('reaches the same reading whether it beats the beat or not', () => {
    const early = run(
      INITIAL,
      { type: 'wake' },
      ...page(),
      { type: 'reading', passages: PASSAGES },
      { type: 'prompt' },
      ...page()
    );
    const late = run(
      INITIAL,
      { type: 'wake' },
      ...page(),
      { type: 'prompt' },
      { type: 'reading', passages: PASSAGES },
      ...page()
    );
    expect(pageOf(early.scene)).toEqual(pageOf(late.scene));
    expect(pageOf(early.scene)?.body).toBe(PASSAGES[0]);
  });

  it('cannot rewrite a page already on screen', () => {
    const reading = run(dealt, { type: 'reading', passages: PASSAGES });
    const onPage = run(reading, ...page());
    const later = reduce(onPage, { type: 'reading', passages: ['different'] });
    expect(pageOf(later.scene)?.body).toBe(PASSAGES[0]);
  });

  it('walks straight to the farewell when the fortune wrote nothing', () => {
    const empty = run(dealt, { type: 'reading', passages: [] }, ...page());
    expect(pageOf(empty.scene)?.body).toBe(RESET_MESSAGE);
    expect(pageOf(empty.scene)?.label).toBe('Complete');
  });
});

describe('advancing', () => {
  it('holds at the reveal prompt while the reading is still in flight', () => {
    const pressed = run(dealt, ...page(), ...page(), ...page());
    expect(pressed.scene).toBe(dealt.scene);
    expect(pressed.refusal).toBeNull();
  });

  it('refuses, visibly, until every card is turned over', () => {
    const blocked = run(
      dealt,
      { type: 'reading', passages: PASSAGES },
      ...page(false)
    );
    expect(blocked.scene.name).toBe('reveal');
    expect(blocked.refusal?.message).toBe(BLOCKED_MESSAGE);

    // Counted, not watched: refusing twice has to shake twice.
    const again = reduce(blocked, { type: 'advance', allRevealed: false });
    expect(again.refusal?.nonce).toBe((blocked.refusal?.nonce ?? 0) + 1);
  });

  it('clears the refusal once the press lands', () => {
    const blocked = run(
      dealt,
      { type: 'reading', passages: PASSAGES },
      ...page(false)
    );
    expect(
      reduce(blocked, { type: 'advance', allRevealed: true }).refusal
    ).toBeNull();
  });

  it('ignores presses while there is nothing on screen', () => {
    for (const state of [INITIAL, run(INITIAL, { type: 'wake' }, ...page())]) {
      expect(run(state, ...page(), ...page())).toBe(state);
    }
  });

  it('fills the page in before it leaves it', () => {
    const woken = reduce(INITIAL, { type: 'wake' });
    const first = reduce(woken, { type: 'advance', allRevealed: true });
    expect(first.scene).toBe(woken.scene);
    expect(first.typed).toBe(true);
    expect(
      reduce(first, { type: 'advance', allRevealed: true }).scene.name
    ).toBe('dealing');
  });

  it('starts every new page untyped', () => {
    let state = run(dealt, { type: 'reading', passages: PASSAGES });
    for (let i = 0; i < 4; i++) {
      state = run(state, ...page());
      expect(state.typed).toBe(false);
    }
  });
});

describe('the reset', () => {
  // reveal -> three passages -> farewell -> leaving.
  const leaving = run(
    dealt,
    { type: 'reading', passages: PASSAGES },
    ...page(),
    ...page(),
    ...page(),
    ...page(),
    ...page()
  );

  it('is terminal: nothing a burst of keypresses can reach', () => {
    expect(leaving.scene.name).toBe('leaving');
    const hammered = run(
      leaving,
      ...Array.from({ length: 40 }, () => ({
        type: 'advance' as const,
        allRevealed: true,
      })),
      { type: 'reading', passages: ['late'] },
      { type: 'prompt' },
      { type: 'wake' }
    );
    expect(hammered.scene).toBe(leaving.scene);
    expect(pageOf(hammered.scene)?.body).toBe(RESET_MESSAGE);
  });

  it('holds the frame it was pressed on rather than blanking under the exit', () => {
    expect(leaving.typed).toBe(true);
    expect(pageOf(leaving.scene)?.key).toBe(pageOf({ name: 'farewell' })?.key);
  });
});

describe('splitReading', () => {
  it('pages on blank lines, which is the shape the prompt pins', () => {
    expect(splitReading('a\n\nb\n\n\nc')).toEqual(['a', 'b', 'c']);
  });

  it('has no passages for anything that is not a reading', () => {
    for (const junk of [undefined, null, 42, {}, '', '   \n\n  ']) {
      expect(splitReading(junk)).toEqual([]);
    }
  });
});
