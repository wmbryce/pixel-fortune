/**
 * The dialog's state machine. Pure: no React, no timers, no DOM.
 *
 * What it replaces was a `stateIndex` into a `dialogStates` array that the
 * fortune mutation rewrote mid-flight, plus a 2200ms `setTimeout` that wrote
 * into the same array. Three bugs came out of that one shape — state changed by
 * something other than the machine, at a time nothing coordinated:
 *
 *  1. a reading arriving in under 2.2s was overwritten by the placeholder timer;
 *  2. the typewriter stopping past 1000 characters never reported completion, so
 *     the Continue button never appeared;
 *  3. machine-fast keypresses through the reset read a stale array.
 *
 * Three properties here make those unrepresentable rather than merely fixed:
 *
 * - **A reading arriving is not a move.** `reading` fills a slot the `Scene`
 *   never lives in, so no arrival — early, late or never — can change where the
 *   visitor is standing.
 * - **A `Scene` carries its own text.** `passage` holds the paragraph, not an
 *   index into an array someone else owns, so a cursor cannot dangle past the
 *   end of anything.
 * - **`leaving` accepts nothing.** The reset is a terminal scene, so a burst of
 *   keypresses during the page exit has nowhere to go.
 */
import { RESET_MESSAGE, REVEAL_MESSAGE, WELCOME_MESSAGE } from './data';

/** The beat before the box has anything to say at all. */
export const WAKE_MS = 1000;
/**
 * The beat between the hand landing and the box asking for the first card.
 * `CardTable` deals inside it: five cards at 260ms plus a 250ms settle, so the
 * spread is at rest before this fires.
 */
export const REVEAL_BEAT_MS = 2200;
/** The lead-in before a page that opens an act starts typing. */
export const LEAD_IN_MS = 1600;
/** The lead-in before every other page. */
export const BEAT_MS = 200;

export const BLOCKED_MESSAGE =
  'You must reveal all the cards before you can continue!';

/**
 * Where the visitor is standing. Every scene is a place the dialog can legally
 * be; there is no combination of fields that names one it cannot.
 */
export type Scene =
  | { name: 'waking' }
  | { name: 'greeting' }
  | { name: 'dealing' }
  | { name: 'reveal' }
  | { name: 'passage'; index: number; text: string }
  | { name: 'farewell' }
  | { name: 'leaving' };

/** The reading the server wrote, split into the paragraphs the box pages. */
export type Reading =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ready'; passages: readonly string[] };

/** A refused advance. Fresh identity per refusal, so the shake re-fires. */
export type Refusal = { message: string; nonce: number };

export type DialogState = {
  scene: Scene;
  reading: Reading;
  /** The current page is entirely on screen — typed out, or skipped to. */
  typed: boolean;
  refusal: Refusal | null;
};

export type DialogEvent =
  | { type: 'wake' }
  | { type: 'prompt' }
  | { type: 'reading'; passages: readonly string[] }
  | { type: 'typed' }
  | { type: 'advance'; allRevealed: boolean };

/**
 * What a scene puts on screen: the prose, the label that leaves it, and an
 * identity. Two scenes sharing a `key` share a page, so the typewriter is not
 * restarted between them.
 */
export type Page = { key: string; body: string; label: string };

export const INITIAL: DialogState = {
  scene: { name: 'waking' },
  reading: { status: 'idle' },
  typed: false,
  refusal: null,
};

/** The only way to change scene, so nothing can move without clearing both. */
const move = (state: DialogState, scene: Scene): DialogState => ({
  ...state,
  scene,
  typed: false,
  refusal: null,
});

const refuse = (state: DialogState, message: string): DialogState => ({
  ...state,
  refusal: { message, nonce: (state.refusal?.nonce ?? 0) + 1 },
});

/** Null when the reading has no such paragraph, whatever the reason. */
const passage = (reading: Reading, index: number): Scene | null => {
  if (reading.status !== 'ready') return null;
  const text = reading.passages[index];
  return text === undefined ? null : { name: 'passage', index, text };
};

/** Scenes with nothing on screen: no page to skip, no control to press. */
const silent = (scene: Scene) =>
  scene.name === 'waking' || scene.name === 'dealing';

function advance(state: DialogState, allRevealed: boolean): DialogState {
  const { scene, reading } = state;
  // `leaving` is terminal on purpose: the page exit is playing over it, and a
  // burst of keypresses must not find anything to do.
  if (silent(scene) || scene.name === 'leaving') return state;

  // A press the visitor can always see land: the first one fills the page in.
  if (!state.typed) return { ...state, typed: true, refusal: null };

  switch (scene.name) {
    case 'greeting':
      // A reading is on its way from the moment the hand is asked for, which is
      // what the button's loading label reads off.
      return {
        ...move(state, { name: 'dealing' }),
        reading: { status: 'pending' },
      };
    case 'reveal':
      if (!allRevealed) return refuse(state, BLOCKED_MESSAGE);
      // The reading is still on its way, and the button already says so.
      if (reading.status !== 'ready') return state;
      return move(state, passage(reading, 0) ?? { name: 'farewell' });
    case 'passage':
      return move(
        state,
        passage(reading, scene.index + 1) ?? { name: 'farewell' }
      );
    case 'farewell':
      // The page exit is about to play over this box, so freeze the frame the
      // visitor pressed on: same page, still typed, still labelled. `move`
      // would blank it and start re-typing under the fade.
      return { ...state, scene: { name: 'leaving' }, refusal: null };
  }
}

export function dialogReducer(
  state: DialogState,
  event: DialogEvent
): DialogState {
  switch (event.type) {
    case 'wake':
      return state.scene.name === 'waking'
        ? move(state, { name: 'greeting' })
        : state;
    case 'prompt':
      return state.scene.name === 'dealing'
        ? move(state, { name: 'reveal' })
        : state;
    case 'reading':
      // Fills a slot; never moves the scene. This is bug 1 made unrepresentable
      // rather than patched — the arrival has no reachable path to the cursor.
      return state.reading.status === 'ready'
        ? state
        : { ...state, reading: { status: 'ready', passages: event.passages } };
    case 'typed':
      return state.typed ? state : { ...state, typed: true, refusal: null };
    case 'advance':
      return advance(state, event.allRevealed);
  }
}

/** Null while the box has nothing to say, which is also when it stays short. */
export function pageOf(scene: Scene): Page | null {
  switch (scene.name) {
    case 'waking':
    case 'dealing':
      return null;
    case 'greeting':
      return { key: 'greeting', body: WELCOME_MESSAGE, label: 'Draw Hand' };
    case 'reveal':
      return { key: 'reveal', body: REVEAL_MESSAGE, label: 'Continue' };
    case 'passage':
      return {
        key: `passage-${scene.index}`,
        body: scene.text,
        label: 'Continue',
      };
    // One page across both, so the box holds the frame the visitor pressed on
    // while the exit plays over it.
    case 'farewell':
    case 'leaving':
      return { key: 'farewell', body: RESET_MESSAGE, label: 'Complete' };
  }
}

/** The two pages that open an act get the long lead-in; the rest get a beat. */
export function leadIn(scene: Scene): number {
  switch (scene.name) {
    case 'greeting':
    case 'reveal':
      return LEAD_IN_MS;
    case 'passage':
      return scene.index === 0 ? LEAD_IN_MS : BEAT_MS;
    default:
      return BEAT_MS;
  }
}

/**
 * The reading's shape is load-bearing: `fortune.ts` pins 4 blank-line-separated
 * paragraphs precisely so this split has something to page. Anything that is
 * not a string — an error, a dropped mutation — is no passages, which walks
 * straight from the reveal to the farewell rather than dead-ending.
 */
export function splitReading(data: unknown): string[] {
  if (typeof data !== 'string') return [];
  return data.split(/\n\s*\n+/).filter(part => part.trim() !== '');
}
