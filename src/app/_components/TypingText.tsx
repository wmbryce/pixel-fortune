'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotionPref, useSettings } from '../_libs/settings';

/**
 * Per character. `normal` is the pace the reading has always been paced at;
 * the rest are the settings modal's text-speed control (#3) — `instant` joins
 * the reduced-motion path below rather than carrying a pace of its own.
 */
const TYPING_MS = { normal: 30, fast: 12 } as const;

type Props = {
  text: string;
  /** Lead-in before the first character. */
  delay: number;
  /** Put the whole of `text` on screen now. */
  skip: boolean;
  /** Called when all of `text` is on screen, however it got there. */
  onDone: () => void;
};

/**
 * Types out the whole of `text`, always, and keeps its own box scrolled to the
 * last line. Owns the scroll box so no ref crosses this seam — the dialog used
 * to hand one in and read its `scrollHeight` during render.
 *
 * One effect per page, not one per character: a single chain of timeouts that
 * the cleanup cancels. The old version awaited a `sleep` inside an effect that
 * re-ran on every index, and capped a page at 1000 characters against a
 * `startIndex` nothing advanced — past that the loop simply stopped, completion
 * never fired, and the Continue button never appeared. Paging is the dialog
 * box's job; this component's only contract is that what it is handed is what
 * the visitor sees.
 */
export default function TypingText({ text, delay, skip, onDone }: Props) {
  const [source, setSource] = useState(text);
  const [count, setCount] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  /**
   * The one animated surface #15 did not reach. The reduced form of a
   * typewriter is the text: there is no travel to cross-fade, and a page that
   * scrolls itself for thirteen seconds is exactly the auto-updating motion the
   * preference is set to opt out of.
   *
   * The lead-in goes with the typing, in full. `delay` is spent by the effect
   * below on the first character, and `instant` returns before that effect does
   * anything at all — so a page paints whole and reports done in the same
   * commit, with no pause in front of it. That is correct rather than merely
   * tolerable: a lead-in is the pause before an animation starts, and there is
   * no longer an animation for it to precede. What is lost is the beat, not the
   * paragraph.
   */
  const { textSpeed } = useSettings();
  const instant = useReducedMotionPref() || skip || textSpeed === 'instant';
  const pace = TYPING_MS[textSpeed === 'fast' ? 'fast' : 'normal'];

  // Adjusted during render rather than in an effect, so a new page never paints
  // a frame of the previous page's progress measured against it.
  if (source !== text) {
    setSource(text);
    setCount(instant ? text.length : 0);
  } else if (instant && count !== text.length) {
    setCount(text.length);
  }

  // Mirrors `count` for the typing effect below, which re-runs when the
  // settings modal changes the pace or the reduced-motion answer mid-page and
  // must resume from where the visitor is, not from character one. Declared
  // before that effect: bodies run in order, so it is current when read.
  const progress = useRef(0);
  useEffect(() => {
    progress.current = count;
  });

  useEffect(() => {
    if (instant) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const step = (n: number) => {
      if (!live || n > text.length) return;
      timer = setTimeout(
        () => {
          if (!live) return;
          setCount(n);
          step(n + 1);
        },
        n === 1 ? delay : pace
      );
    };
    step(progress.current + 1);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text, delay, instant, pace]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  // Once per page, whatever `onDone`'s identity does between renders. Reporting
  // on every render that happens to be complete is how a caller that passes an
  // inline callback ends up in a render loop.
  const reported = useRef<string | null>(null);
  const done = count >= text.length;
  useEffect(() => {
    if (!done || reported.current === text) return;
    reported.current = text;
    onDone();
  }, [done, text, onDone]);

  return (
    <div ref={scroller} className="flex px-8 pt-8 pb-16 overflow-y-auto">
      {/* The theatre, not the content: a screen reader following this would
          hear a character at a time. `DialogBox` announces the whole page
          once, from a live region that outlives this one. */}
      <p aria-hidden="true" className="inline-block font-pixel text-base pb-16">
        {text.slice(0, count)}
      </p>
    </div>
  );
}
