/**
 * Motion tokens (audit finding #12). Every duration and spring in the app used
 * to be hand-typed at its call site, so the reveal, the deal and the page
 * transitions had no way to agree with each other.
 *
 * Springs are the default because every one of them can be interrupted — a
 * spring retargets from the value on screen, a keyframe restarts from zero.
 * `bounce: 0` unless the gesture that started the motion carried momentum;
 * nothing here is dragged or flicked, so only `snap` (a control settling into
 * a resting place of its own accord) spends any.
 *
 * A `motion` 12 spring honours `duration` — measured, see `plans/animation-audit.md`
 * — so these are real settle times, and all of them are inside the 300-500ms
 * budget for the surface they move.
 */
import type { Transition } from 'motion/react';

export const SPRING = {
  /** Hover lift and press. Feedback has to land before the eye looks for it. */
  nudge: { type: 'spring', bounce: 0, duration: 0.2 },
  /** The card flip, critically damped: a tap carries no momentum (#13). */
  flip: { type: 'spring', bounce: 0, duration: 0.4 },
  /** A control arriving at rest — the only place bounce is earned. */
  snap: { type: 'spring', bounce: 0.2, duration: 0.4 },
  /** A surface travelling in from off-screen. */
  arrive: { type: 'spring', bounce: 0, duration: 0.55 },
  /** A surface finding its place once it is already on screen. */
  settle: { type: 'spring', bounce: 0, duration: 0.45 },
} satisfies Record<string, Transition>;

/** Strong ease-out. Built-in `ease-out` is too weak to read as deliberate. */
export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export const DURATION = {
  /** Route change. Long enough to connect two screens, short enough to skip. */
  page: 0.24,
  /** The reduced-motion substitute for any of the springs above. */
  crossfade: 0.2,
  /** The blocked-continue shake. */
  shake: 0.36,
} as const;

/**
 * What replaces a spring when the visitor asks for reduced motion. It is a
 * cross-fade, not a disable: the state change still has to be visible, so
 * opacity carries what travel used to. Per `/apple-design` §14.
 */
export const CROSSFADE = {
  duration: DURATION.crossfade,
  ease: EASE_OUT,
} satisfies Transition;

/**
 * The refusal. A keyframe rather than a spring because it has to come back to
 * exactly where it started, and the amplitudes decay so the last swing reads as
 * settling rather than stopping. In px, on `x`.
 */
export const SHAKE = {
  keyframes: [0, -8, 8, -5, 5, 0] as number[],
  transition: {
    duration: DURATION.shake,
    ease: EASE_OUT,
  } satisfies Transition,
};

/** The press dim that stands in for a lift under reduced motion. */
export const DIM = {
  hover: 0.9,
  press: 0.75,
} as const;
