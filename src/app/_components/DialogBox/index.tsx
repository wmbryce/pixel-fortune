'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
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
import { isAnyKeyPress } from '../../_libs/keys';
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

/**
 * The reveal prompt's two silent moments, said out loud.
 *
 * `machine.ts` is right not to model either: a press it declines to act on is
 * not a move, and the reading landing is not one either — that is the property
 * the whole machine is built on. But the consequence is that a visitor standing
 * at the prompt with every card turned presses a control labelled `loading`,
 * gets back the identical state, and is told nothing — not that the press
 * landed, and not that the control became pressable a few seconds later.
 *
 * So these are the component's, not the machine's: presentation, a string in a
 * polite region, never dialog state and never an event.
 */
export const WAITING_MESSAGE =
  'Your reading is still being written. The continue button will say when it is ready.';
export const READY_MESSAGE = 'Your reading is ready. Press continue.';

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

  /**
   * The reveal prompt, with the reading still on its way — the one place an
   * advance is neither taken nor refused. Read off the same two fields the
   * button's `loading` label is, because it is the same fact.
   */
  const waitingOnReading =
    scene.name === 'reveal' && state.reading.status !== 'ready';

  // Carried like `Refusal`, and for the same reason: the messages are fixed, so
  // a repeat is identical text in a region that never changed and no assistive
  // path fires. A nonce makes each one a fresh node.
  const [status, setStatus] = useState<{
    message: string;
    nonce: number;
  } | null>(null);
  const say = useCallback(
    (message: string) =>
      setStatus(current => ({ message, nonce: (current?.nonce ?? 0) + 1 })),
    []
  );

  /**
   * The half that matters most: the control becomes pressable on its own, some
   * seconds after the visitor last touched anything, and nothing else says so.
   *
   * It is the *transition* that is announced, not the state — a reading already
   * in hand when the prompt opens is what the button's own label says, and
   * needs no second telling. So the last pair is carried and compared, and a
   * scene change clears the region rather than leaving a stale line behind for
   * a visitor reading the page.
   *
   * Adjusted during render, the way `TypingText` tracks its page: an effect
   * would be a second render's worth of cascade for a value this one already
   * knows.
   */
  const [last, setLast] = useState({
    scene: scene.name,
    waiting: waitingOnReading,
  });
  if (last.scene !== scene.name || last.waiting !== waitingOnReading) {
    setLast({ scene: scene.name, waiting: waitingOnReading });
    if (last.scene !== scene.name) setStatus(null);
    else if (last.waiting) say(READY_MESSAGE);
  }

  const activated = useRef(false);
  const press = useCallback(() => {
    activated.current = true;
    // Acknowledge the press the machine will decline, so it is never silent.
    // Only once the page is on screen: before that the press fills the page in,
    // which is a press that already landed visibly.
    if (waitingOnReading && allRevealed && state.typed) say(WAITING_MESSAGE);
    dispatch({ type: 'advance', allRevealed });
  }, [allRevealed, waitingOnReading, state.typed, say]);
  const typed = useCallback(() => dispatch({ type: 'typed' }), []);

  // "Press any key to continue", so this is on the window rather than on the
  // control — but a focused button already answers Enter and Space with a click
  // of its own, so answering those two here as well would step the dialog
  // twice. That guard now covers the cards too, which are buttons of their own,
  // and it is what keeps Space working on a focused control now that
  // `isAnyKeyPress` refuses it ambiently as the page's scroll key.
  // `isAnyKeyPress` takes out the rest: Tab reaches those cards, and answering
  // it here refused the advance and shook the box on every step between them.
  const anyKey = useCallback(
    (event: KeyboardEvent) => {
      if (!isAnyKeyPress(event)) return;
      if (
        event.target instanceof HTMLButtonElement &&
        (event.key === 'Enter' || event.key === ' ')
      )
        return;
      press();
    },
    [press]
  );

  /**
   * The button is unmounted while a page types and mounted again when it is
   * done, so pressing it drops focus to `<body>` every time — a keyboard
   * visitor would have to tab back in at each paragraph. Give it back, but only
   * from `<body>`: if the visitor has tabbed off to a card, the reveal prompt
   * finishing its 13 seconds of typing must not pull them out of the spread.
   *
   * Handing it *back* is the whole of the job, so the first arrival is
   * deliberately excluded — `<body>` is also what holds focus when nobody has
   * touched anything yet. The live region fires the greeting whole about a
   * second in, and a focus move mid-announcement cuts off the one thing telling
   * the visitor where they are. `activated` is a ref rather than state because
   * remembering this must not re-render the box.
   */
  const keepFocus = useCallback((node: HTMLButtonElement | null) => {
    if (node && activated.current && document.activeElement === document.body)
      node.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', anyKey);
    return () => window.removeEventListener('keydown', anyKey);
  }, [anyKey]);

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
        visible: {
          y: '0%',
          opacity: 1,
          height: '256px',
          transition: CROSSFADE,
        },
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
      {/*
        The reading, one announcement per page.

        The granularity is the whole paragraph, deliberately. A live region on
        the text the typewriter is building announces a character at a time —
        thirty times a second of "T", "Th", "The" — which is noise, not access.
        A region on the *page* fires once, when the box turns to a new
        paragraph, and says the whole of it; the typed copy is `aria-hidden`, so
        it is said once rather than twice. `aria-atomic` because a paragraph is
        one utterance and half of it is not worth hearing.

        It sits outside the keyed `TypingText` on purpose: a live region has to
        be in the document *before* its content changes to be announced, and
        that one is torn down and rebuilt at every page.

        The consequence is that a screen reader hears the paragraph in full
        while the typewriter is still on its first characters. That is the right
        way round — the reading is the content, the typing is the theatre — and
        the visitor is not made to wait 13 seconds for a button.
      */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {page?.body ?? ''}
      </p>
      {/*
        Status, and only status — never the reading, which the region above
        owns. It is a separate region precisely so the two cannot overwrite each
        other: this one speaks while the visitor is standing at the reveal
        prompt, which is exactly when that one is holding the prompt's prose.

        The region itself is permanent and the message inside it is keyed,
        because a live region must be in the document before its content changes
        to be announced — and because the same string said twice has to be two
        nodes to be heard twice.
      */}
      <p className="sr-only" role="status" aria-atomic="true">
        {status && <span key={status.nonce}>{status.message}</span>}
      </p>
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
                // Keyed on the nonce so a second refusal replaces the node
                // rather than rewriting nothing: the message is the same every
                // time, and an alert that does not change is never announced.
                <p
                  key={refusal.nonce}
                  role="alert"
                  className="font-sans mr-4 text-brown_03"
                >
                  {refusal.message}
                </p>
              )}
              <DialogButton
                id="dialogButton"
                ref={keepFocus}
                onClick={press}
                loading={waitingOnReading}
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
