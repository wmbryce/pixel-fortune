'use client';

import React, { useMemo, useEffect, useState } from 'react';

type Props = {
  text: string;
  delay: number;
  skip: boolean;
  setTypingComplete: any;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Types out the whole of `text`, always.
 *
 * There used to be a 1000-character ceiling here, paired with a `startIndex`
 * that nothing ever advanced — the stub of a pagination scheme that was never
 * built. Past 1000 characters the loop simply stopped: the rest of the
 * paragraph was never typed, `setTypingComplete` never fired, so the Continue
 * button never appeared and the reading dead-ended unless the visitor happened
 * to press a key. Paging is the dialog box's job (it splits the reading on
 * blank lines); this component's only contract is that what it is handed is
 * what the visitor sees.
 */
export const TypingText = React.forwardRef(
  ({ text, delay, skip, setTypingComplete }: Props, ref: any) => {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [delayComplete, setDelayComplete] = useState<boolean>(false);

    const typingInterval = 30;

    useEffect(() => {
      setCurrentIndex(0);
      setTypingComplete(false);
    }, [text]);

    useEffect(() => {
      const scrollToBottom = () => {
        if (ref?.current) {
          ref.current.scrollTop = ref.current.scrollHeight + 10;
        }
      };
      const type = async () => {
        if (skip) {
          setCurrentIndex(text?.length);
          setTypingComplete(true);
          setDelayComplete(false);
        } else if (delayComplete && text?.length > currentIndex) {
          setTypingComplete(false);
          await sleep(typingInterval);
          setCurrentIndex(prev => prev + 1);
          if (currentIndex + 1 === text?.length) {
            setTypingComplete(true);
            setDelayComplete(false);
          }
          scrollToBottom();
        } else {
          await sleep(delay);
          setDelayComplete(true);
        }
      };
      type();
    }, [currentIndex, text, skip, delay, setTypingComplete, delayComplete]);

    const displayText = useMemo(
      () => text.substring(0, currentIndex),
      [currentIndex, text]
    );

    return (
      <p className={'inline-block font-pixel text-base pb-16'}>{displayText}</p>
    );
  }
);

TypingText.displayName = 'TypingText';

export default TypingText;
