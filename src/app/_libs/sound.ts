'use client';
/**
 * The app's whole voice (#4): three cues, synthesized on the spot with two
 * oscillators and an envelope. Nothing is fetched and nothing is bundled —
 * square and triangle waves are the native sound of the pixel art this app is
 * made of, and a downloaded chime would carry licence terms and kilobytes for
 * a hundred milliseconds of noise.
 *
 * The three rules this file exists to hold:
 *
 * - **Off until asked.** `enabled` starts false and only `setSoundEnabled` and
 *   the `useSound` sync move it, both from the `sound` key the visitor ticks.
 *   No context is constructed before that, so a first visit is silent to the
 *   point of never touching the Web Audio API at all.
 * - **A context is only ever born inside a gesture.** An `AudioContext`
 *   constructed outside one starts suspended and logs an autoplay warning when
 *   resumed, so `arm` runs from a window `pointerdown`/`keydown` (and from the
 *   tick that turns sound on, which is itself a click). `playCue` refuses
 *   anything but a running context rather than trying to start one, which is
 *   why a cue that lands before the first gesture is dropped silently instead
 *   of warning.
 * - **Reduced motion covers sound.** A visitor who has asked for calm — OS
 *   preference or the app override, whichever — is asking the page to stop
 *   doing things at them unprompted, and an unasked-for noise is that in
 *   another sense. `useSound` ANDs `useReducedMotionPref()` in, so reduced
 *   motion is silence even with the toggle on.
 *
 * There is one context per document, closed again when sound is turned off, so
 * a route change leaks nothing; every node a cue makes is disconnected from its
 * own `onended`.
 */
import { useEffect } from 'react';
import { useReducedMotionPref, useSettings } from './settings';

export type Cue =
  /** A card turning face up. */
  | 'reveal'
  /** A page of dialog actually turning — never a refused press. */
  | 'advance'
  /** The reading landing, which happens with nobody touching anything. */
  | 'arrive';

type Note = {
  wave: OscillatorType;
  freq: number;
  /** Seconds after the cue begins. */
  at: number;
  /** Seconds of sound, envelope included. */
  dur: number;
  /** Peak amplitude before `MASTER`. */
  gain: number;
};

/** Quiet: this app is unhurried, and a cue is punctuation, not an event. */
const MASTER = 0.12;
/** Long enough that the square wave opens without a click, short enough to read as instant. */
const ATTACK = 0.005;
/** `exponentialRampToValueAtTime` cannot ramp to zero. */
const SILENCE = 0.0001;

const CUES: Record<Cue, readonly Note[]> = {
  // Two steps up, D5 then A5: the card is turning towards you.
  reveal: [
    { wave: 'square', freq: 587.33, at: 0, dur: 0.07, gain: 0.5 },
    { wave: 'square', freq: 880, at: 0.05, dur: 0.09, gain: 0.5 },
  ],
  // One soft tick. It fires on every page of a four-paragraph reading, so it
  // is the one cue that has to survive being heard ten times.
  advance: [{ wave: 'square', freq: 440, at: 0, dur: 0.05, gain: 0.35 }],
  // An A major arpeggio on a triangle — rounder than the blips, because this
  // one is news rather than an acknowledgement.
  arrive: [
    { wave: 'triangle', freq: 440, at: 0, dur: 0.16, gain: 0.8 },
    { wave: 'triangle', freq: 554.37, at: 0.09, dur: 0.16, gain: 0.8 },
    { wave: 'triangle', freq: 659.25, at: 0.18, dur: 0.26, gain: 0.8 },
  ],
};

let enabled = false;
let ctx: AudioContext | null = null;
let listening = false;

/** The gesture types that satisfy the autoplay policy for creating a context. */
const GESTURES = ['pointerdown', 'keydown'] as const;

/**
 * Take the gesture. Kept as a live listener rather than a one-shot: a browser
 * may suspend the context again when the tab goes to the background, and the
 * next interaction is what is allowed to resume it.
 */
const arm = () => {
  if (!enabled || typeof window === 'undefined' || !('AudioContext' in window))
    return;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
};

const listen = () => {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  // Capture, so a handler that stops propagation — the modal triggers do —
  // cannot cost us the gesture.
  for (const type of GESTURES) window.addEventListener(type, arm, true);
};

const unlisten = () => {
  if (!listening) return;
  listening = false;
  for (const type of GESTURES) window.removeEventListener(type, arm, true);
};

/**
 * Turning sound off closes the context rather than muting it: it is hardware,
 * and the visitor asked for it to stop.
 */
export const setSoundEnabled = (on: boolean) => {
  if (on === enabled) return;
  enabled = on;
  if (on) {
    listen();
    return;
  }
  unlisten();
  void ctx?.close();
  ctx = null;
};

/**
 * Nothing here starts a context. A cue that arrives before the first gesture,
 * or while the browser has the context suspended, is dropped — the alternative
 * is a `resume()` outside a gesture, which is exactly the console warning this
 * module is built to never produce.
 */
const playCue = (cue: Cue) => {
  const context = ctx;
  if (!context || context.state !== 'running') return;
  const start = context.currentTime;
  for (const note of CUES[cue]) {
    const osc = context.createOscillator();
    const env = context.createGain();
    const from = start + note.at;
    const to = from + note.dur;
    osc.type = note.wave;
    osc.frequency.setValueAtTime(note.freq, from);
    env.gain.setValueAtTime(0, from);
    env.gain.linearRampToValueAtTime(note.gain * MASTER, from + ATTACK);
    env.gain.exponentialRampToValueAtTime(SILENCE, to);
    osc.connect(env).connect(context.destination);
    osc.start(from);
    osc.stop(to);
    // The whole of the cleanup: a cue's nodes live exactly as long as it sounds.
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }
};

/** Module-level, so its identity never changes and no effect re-fires on it. */
const play = (cue: Cue) => {
  if (enabled) playCue(cue);
};

/**
 * The tick in the settings modal is itself the gesture the autoplay policy
 * wants, so take it there rather than making the visitor produce another one —
 * and answer with the cue, which is the only confirmation the toggle has.
 */
export const setSoundFromGesture = (on: boolean) => {
  setSoundEnabled(on);
  if (on) {
    arm();
    playCue('arrive');
  }
};

/**
 * The one place the setting reaches the engine, mounted once in the root layout
 * by `SettingsBridge` — the same job it already does for the reduce-motion
 * attribute. Keeping it there rather than in `useSound` means a visitor who
 * ticks reduce-motion on the welcome screen, where nothing plays anything, has
 * still shut the context down by the time they reach the cards.
 */
export const useSoundSync = () => {
  const { sound } = useSettings();
  const reduced = useReducedMotionPref();
  useEffect(() => setSoundEnabled(sound && !reduced), [sound, reduced]);
};

/**
 * What a surface with something to say calls. It is the module function itself,
 * so its identity never changes and it is safe in a dependency list.
 */
export const useSound = (): ((cue: Cue) => void) => play;
