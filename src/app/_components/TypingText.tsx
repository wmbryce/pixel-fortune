'use client';

import { useEffect, useRef, useState } from 'react';

/** 30ms a character, the pace the reading has always been paced at. */
const TYPING_MS = 30;

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

  // Adjusted during render rather than in an effect, so a new page never paints
  // a frame of the previous page's progress measured against it.
  if (source !== text) {
    setSource(text);
    setCount(0);
  } else if (skip && count !== text.length) {
    setCount(text.length);
  }

  useEffect(() => {
    if (skip) return;
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
        n === 1 ? delay : TYPING_MS
      );
    };
    step(1);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text, delay, skip]);

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
      <p className="inline-block font-pixel text-base pb-16">
        {text.slice(0, count)}
      </p>
    </div>
  );
}
