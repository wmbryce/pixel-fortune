'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import { trpc } from '../../_trpc/client';
import { DialogButton } from '../DialogButton';
import TypingText from '../TypingText';
import { usePageLeave } from '../PageTransition';
import { CROSSFADE, SHAKE, SPRING } from '../../_libs/motion';
import {
  INITIAL,
  REVEAL_BEAT_MS,
  WAKE_MS,
  dialogReducer,
  leadIn,
  pageOf,
  splitReading,
  type Scene,
} from './machine';

type Props = {
  /**
   * Empty until a hand is on the table. It is the deal's opaque handle — the
   * server resolves the reading from it — and its arrival *is* the news that
   * the cards have landed, so the box needs nothing else about them.
   */
  readingToken: string;
  allRevealed: boolean;
  /** Deal a hand. Called once, when the visitor leaves the welcome page. */
  onDraw: () => void;
  /** Clear the table. Called once, as the reset navigates away. */
  onReset: () => void;
};

/**
 * The RPG dialog box. `machine.ts` owns where the visitor is and what may
 * happen next; this file owns the clock, the network and the pixels, and every
 * one of them talks to the machine by dispatching an event. Nothing else writes
 * dialog state — that is the whole point of the rebuild.
 */
export default function DialogBox({
  readingToken,
  allRevealed,
  onDraw,
  onReset,
}: Props) {
  const [state, dispatch] = useReducer(dialogReducer, INITIAL);
  const reduced = useReducedMotion() ?? false;
  const leave = usePageLeave();
  const shakeX = useMotionValue(0);

  const { mutate: fetchFortune } = trpc.getFortune.useMutation({
    onSettled: data =>
      dispatch({ type: 'reading', passages: splitReading(data) }),
  });

  const { scene, refusal } = state;
  const page = pageOf(scene);
  const dealing = scene.name === 'dealing';

  /**
   * The one place the machine reaches outside itself, and it is one-way: scenes
   * in, calls out. Guarded on the scene being entered rather than on the deps,
   * so a re-render carrying a fresh `onDraw` or `leave` cannot deal a second
   * hand or navigate twice.
   */
  const acted = useRef<Scene['name'] | null>(null);
  useEffect(() => {
    if (acted.current === scene.name) return;
    acted.current = scene.name;
    if (scene.name === 'dealing') onDraw();
    if (scene.name === 'leaving') {
      onReset();
      // Back out the way we came in, and let the exit play before the route
      // changes under it.
      leave('/welcome', 'back');
    }
  }, [scene.name, onDraw, onReset, leave]);

  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: 'wake' }), WAKE_MS);
    return () => clearTimeout(t);
  }, []);

  // Exactly one generation per token, whatever React does with this effect —
  // a reading is money, and a second call would reserve budget twice.
  const requested = useRef<string | null>(null);
  useEffect(() => {
    if (!dealing || !readingToken) return;
    if (requested.current === readingToken) return;
    requested.current = readingToken;
    fetchFortune({ token: readingToken });
  }, [dealing, readingToken, fetchFortune]);

  // The box asks for the first card a beat after the hand lands, and only ever
  // because of this beat: the reading may arrive before, during or after it.
  useEffect(() => {
    if (!dealing || !readingToken) return;
    const t = setTimeout(() => dispatch({ type: 'prompt' }), REVEAL_BEAT_MS);
    return () => clearTimeout(t);
  }, [dealing, readingToken]);

  // Refusing to continue used to move nothing at all — the prose appeared and
  // that was the whole answer (audit, missed opportunity 3). Reduced motion
  // keeps the prose and skips the shake, which is pure vestibular noise.
  useEffect(() => {
    if (!refusal || reduced) return;
    const controls = animate(shakeX, SHAKE.keyframes, SHAKE.transition);
    return () => controls.stop();
  }, [refusal, reduced, shakeX]);

  const press = useCallback(
    () => dispatch({ type: 'advance', allRevealed }),
    [allRevealed]
  );
  const typed = useCallback(() => dispatch({ type: 'typed' }), []);

  useEffect(() => {
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  }, [press]);

  /**
   * The box slides up from below and grows once it has something to say. All
   * three of these used to be `{ duration: 1, type: 'spring' }` — a real 1000ms
   * each, measured (audit finding #3) — and now come from the tokens.
   *
   * `height` stays on the timeline rather than becoming a `scaleY`, which was
   * left open by #15 and is settled here: the 8px pixel border and the
   * typewriter's scroll box both distort under a scale, and the strip the box
   * grows inside is reserved (`tarot/page.tsx`), so the layout it costs is its
   * own and moves nothing else on the page.
   *
   * Reduced motion drops the 200% travel and cross-fades the box in on the
   * spot; the height still changes, because that is the box telling you it now
   * holds a reading rather than a spinner.
   */
  const dialogVariants = reduced
    ? ({
        hidden: { y: '0%', opacity: 0, height: '64px' },
        loading: { y: '0%', opacity: 1, height: '64px', transition: CROSSFADE },
        visible: { y: '0%', opacity: 1, height: '256px', transition: CROSSFADE },
      } as const)
    : ({
        hidden: { y: '200%', opacity: 1, height: '64px' },
        loading: {
          y: '0%',
          opacity: 1,
          height: '64px',
          transition: { y: SPRING.arrive },
        },
        visible: {
          y: '0%',
          opacity: 1,
          height: '256px', // equivalent to h-64
          transition: { height: SPRING.settle, y: SPRING.arrive },
        },
      } as const);

  return (
    <motion.div
      style={{ x: shakeX }}
      className="relative flex flex-col flex-1 w-[100%] items-center opacity-[90%]"
    >
      <motion.div
        className="flex flex-col justify-between w-[100%] bg-brown_02 border-brown_01 border-8 text-brown_03 overflow-y-scroll rounded-md mt-6"
        variants={dialogVariants}
        initial="hidden"
        animate={page ? 'visible' : 'loading'}
      >
        {page && (
          // Keyed on the page, so "a new page starts from the beginning" holds
          // even for two paragraphs that happen to read the same.
          <TypingText
            key={page.key}
            text={page.body}
            delay={leadIn(scene)}
            skip={state.typed}
            onDone={typed}
          />
        )}
        {/* The one `AnimatePresence` in here with a child that actually comes
            and goes. The two that wrapped permanently-mounted elements, and the
            `layoutId` with nothing to travel between, are gone (finding #11). */}
        <AnimatePresence>
          {page && state.typed && (
            <motion.div
              // Was `{ duration: 2, type: 'spring' }` — a real 2000ms settle on
              // the app's primary control (finding #9).
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: '100%' }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: '0%' }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: '100%' }}
              className="flex flex-row items-center border-t-[2px] border-brown_01 justify-end bg-[#FFFFFF00] p-2 text-brown_02 font-sans"
              transition={reduced ? CROSSFADE : SPRING.snap}
            >
              {refusal && (
                <p className="font-sans mr-4 text-brown_03">{refusal.message}</p>
              )}
              <DialogButton
                id="dialogButton"
                onClick={press}
                loading={
                  scene.name === 'reveal' && state.reading.status !== 'ready'
                }
              >
                {page.label}
              </DialogButton>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
