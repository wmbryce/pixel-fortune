/**
 * The sound engine (#4). Everything worth breaking here is invisible — audio's
 * failures are all silent, or worse, unasked-for noise — so these hold the four
 * promises the module makes: off until asked, no context before a gesture,
 * silence under reduced motion, and every node released.
 *
 * jsdom ships no Web Audio API at all, and that is load-bearing rather than
 * incidental: every other spec renders `Card` and `DialogBox` with sound off
 * and never stubs an `AudioContext`, so a module that constructed one eagerly
 * would fail the whole suite rather than this file.
 */
import React from 'react';
import { render, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Well past the 2200ms reveal beat, so the arrival is its own moment. */
const fortuneDelayMs = 4000;
vi.mock('../src/app/_trpc/client', () => ({
  trpc: {
    getFortune: {
      useMutation: (opts: { onSettled: (data: unknown) => void }) => ({
        mutate: () =>
          setTimeout(() => opts.onSettled('One.\n\nTwo.'), fortuneDelayMs),
      }),
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

import AppMenu from '@/app/_components/AppMenu';
import Card from '@/app/_components/Card';
import DialogBox from '@/app/_components/DialogBox';
import SettingsBridge from '@/app/_components/SettingsBridge';
import {
  STORAGE_KEY,
  reloadSettings,
  updateSettings,
} from '@/app/_libs/settings';
import { setSoundEnabled, setSoundFromGesture } from '@/app/_libs/sound';

/* -- a Web Audio API just real enough to record what was asked of it -------- */

type Note = { wave: string; freq: number };
type Node = { disconnect: ReturnType<typeof vi.fn> };

class FakeContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  /** One entry per oscillator, in the order the cue asked for them. */
  notes: Note[] = [];
  /** Every node handed out, so the release can be checked against all of them. */
  nodes: Node[] = [];
  ended: (() => void)[] = [];
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());

  constructor() {
    contexts.push(this);
  }

  createOscillator() {
    const note: Note = { wave: 'sine', freq: 0 };
    const ended = this.ended;
    const osc = {
      set type(value: string) {
        note.wave = value;
      },
      frequency: {
        setValueAtTime: (freq: number) => {
          note.freq = freq;
        },
      },
      connect: (target: unknown) => target,
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      set onended(fn: () => void) {
        ended.push(fn);
      },
    };
    this.notes.push(note);
    this.nodes.push(osc);
    return osc;
  }

  createGain() {
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: (target: unknown) => target,
      disconnect: vi.fn(),
    };
    this.nodes.push(gain);
    return gain;
  }
}

let contexts: FakeContext[] = [];
const context = () => contexts[contexts.length - 1];
/** What has sounded since the last `clearNotes`, rounded to whole Hz. */
const freqs = () => context()?.notes.map(n => Math.round(n.freq)) ?? [];
const waves = () => context()?.notes.map(n => n.wave) ?? [];
const clearNotes = () => {
  context()?.notes.splice(0);
  context()?.nodes.splice(0);
  context()?.ended.splice(0);
};

const REVEAL = [587, 880];
const ADVANCE = [440];
const ARRIVE = [440, 554, 659];

beforeEach(() => {
  // Back to the module's cold state — it closes the context and drops the
  // window listeners — so no test inherits another's engine.
  setSoundEnabled(false);
  contexts = [];
  // Assigned and deleted by hand rather than through `vi.stubGlobal`, which
  // would take `setup.ts`'s `matchMedia` down with it on the way out — and the
  // module's own guard is `'AudioContext' in window`, so it must really go.
  Object.assign(window, { AudioContext: FakeContext });
  window.localStorage.clear();
  reloadSettings();
});

afterEach(() => {
  setSoundEnabled(false);
  Reflect.deleteProperty(window, 'AudioContext');
});

/* -------------------------------------------------------------------------- */

const DATA = { id: 0, name: 'The Fool', image: 'Tarot_00_Fool.png' };

const renderCard = (reveal = false) =>
  render(
    <Card
      id="t-card-0"
      index={0}
      width={96}
      data={DATA}
      reveal={reveal}
      setReveal={vi.fn()}
    />
  );

const clickCard = () =>
  act(() => {
    document.getElementById('t-card-0')!.click();
  });

const renderMenu = () => {
  render(<SettingsBridge />);
  render(<AppMenu />);
};

const openSettings = () => {
  const trigger = [...document.querySelectorAll('button')].find(
    b => b.textContent === 'Settings' && !b.closest('dialog')
  )!;
  fireEvent.click(trigger);
  return within(document.querySelector('dialog')!);
};

/** Not wrapped in `act`: the modal has to be committed before it is read. */
const tickSetting = (label: string) =>
  fireEvent.click(openSettings().getByLabelText(label));

const stored = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);

describe('sound, before the visitor asks for it', () => {
  it('constructs no AudioContext at all — not on a gesture, not on a reveal', () => {
    renderMenu();
    renderCard();
    fireEvent.pointerDown(window);
    fireEvent.pointerUp(window);
    fireEvent.touchEnd(window);
    fireEvent.keyDown(window, { key: 'a' });
    clickCard();
    expect(contexts).toHaveLength(0);
  });

  it('shows the toggle off, which is the only safe default', () => {
    renderMenu();
    const panel = openSettings();
    expect(panel.getByLabelText<HTMLInputElement>('Sound').checked).toBe(false);
  });
});

describe('the toggle', () => {
  it('takes its own tick as the gesture, and answers with a cue', () => {
    renderMenu();
    tickSetting('Sound');
    expect(contexts).toHaveLength(1);
    expect(freqs()).toEqual(ARRIVE);
    expect(stored().sound).toBe(true);
  });

  it('closes the context again when it is turned off', () => {
    renderMenu();
    tickSetting('Sound');
    const ctx = context();
    tickSetting('Sound');
    expect(ctx.close).toHaveBeenCalled();
    expect(stored().sound).toBe(false);
    // The listeners went with it: a later gesture starts nothing.
    fireEvent.pointerDown(window);
    fireEvent.pointerUp(window);
    fireEvent.touchEnd(window);
    fireEvent.keyDown(window, { key: 'x' });
    expect(contexts).toHaveLength(1);
  });

  it('arms on a plain gesture when the setting is already stored', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sound: true }));
    reloadSettings();
    renderMenu();
    // Mounting is not a gesture, so still nothing.
    expect(contexts).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'x' });
    expect(contexts).toHaveLength(1);
  });

  /**
   * A tap grants user activation at its end, not its start, so the end of the
   * tap is what must arm — a `pointerdown`-only listener would build the
   * context a moment too early and get it suspended.
   */
  it('arms on the end of a tap, where activation is granted', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sound: true }));
    reloadSettings();
    renderMenu();
    fireEvent.pointerUp(window);
    expect(contexts).toHaveLength(1);
    // A backgrounded tab suspends the context; Safari's `touchend` — the next
    // interaction's end — is allowed to resume it.
    context().state = 'suspended';
    fireEvent.touchEnd(window);
    expect(context().resume).toHaveBeenCalled();
  });
});

describe('reduced motion', () => {
  it('is silence, whatever the toggle says', () => {
    renderMenu();
    tickSetting('Reduce motion');
    tickSetting('Sound');
    // The setting is remembered; it is the engine that stays shut.
    expect(stored().sound).toBe(true);
    expect(contexts).toHaveLength(0);
    fireEvent.pointerDown(window);
    fireEvent.pointerUp(window);
    expect(contexts).toHaveLength(0);
  });
});

describe('the cues', () => {
  beforeEach(() => {
    setSoundFromGesture(true);
    clearNotes();
  });

  it('sounds a card turning, and only when it turns', () => {
    renderCard();
    clickCard();
    expect(freqs()).toEqual(REVEAL);
    expect(waves()).toEqual(['square', 'square']);
  });

  /**
   * A revealed card stays enabled — disabling the one holding focus strands it
   * (#18) — so it is still pressable and must still be silent.
   */
  it('says nothing when a card that is already up is pressed again', () => {
    renderCard(true);
    clickCard();
    expect(freqs()).toEqual([]);
  });

  it('releases every node it made', () => {
    renderCard();
    clickCard();
    const ctx = context();
    expect(ctx.ended).toHaveLength(REVEAL.length);
    ctx.ended.forEach(end => end());
    ctx.nodes.forEach(node => expect(node.disconnect).toHaveBeenCalled());
  });
});

/**
 * The dialog box asks the machine what a press will do before making it, so
 * this is where "never a cue for something that did not happen" is pinned.
 * `instant` text takes the typewriter out of the timing: a page paints whole
 * and reports done in the same commit, so every press below is a real advance.
 */
describe('the dialog box', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    updateSettings({ textSpeed: 'instant' });
    setSoundFromGesture(true);
    clearNotes();
  });
  afterEach(() => vi.useRealTimers());

  const tick = async (ms: number) => {
    for (let t = 0; t < ms; t += 50)
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
  };
  const press = async () => {
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
  };

  it('sounds a page that turns, and the reading landing — never a refusal', async () => {
    render(
      <DialogBox
        readingToken="tok"
        allRevealed={false}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />
    );

    // Waking: no page, nothing to turn.
    await press();
    expect(freqs()).toEqual([]);

    // The greeting, and the press that deals the hand.
    await tick(1200);
    await press();
    expect(freqs()).toEqual(ADVANCE);

    // Dealing: silent again, and the reveal prompt a beat later.
    clearNotes();
    await press();
    expect(freqs()).toEqual([]);

    // The reveal prompt with no card turned — refused, shaken, and silent.
    await tick(2400);
    clearNotes();
    await press();
    expect(freqs()).toEqual([]);

    // The reading lands with nobody touching anything.
    await tick(4000);
    expect(freqs()).toEqual(ARRIVE);
  });
});
