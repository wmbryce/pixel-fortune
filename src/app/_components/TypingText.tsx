'use client';

import React, {
  SetStateAction,
  useMemo,
  useEffect,
  useState,
  useRef,
} from 'react';
import { DialogButton } from './DialogButton';

type Props = {
  ref: any;
  text: string;
  delay: number;
  skip: boolean;
  setTypingComplete: any;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const TypingText = React.forwardRef(
  ({ text, delay, skip, setTypingComplete }: Props, ref: any) => {
    const startIndex = useRef<number>(0);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [delayComplete, setDelayComplete] = useState<boolean>(false);

    const typingInterval = 30;
    const maxCharacters = 1000;

    useEffect(() => {
      setCurrentIndex(0);
      startIndex.current = 0;
      setTypingComplete(false);
    }, [text]);

    useEffect(() => {}, [ref?.current?.scrollHeight]);

    // console.log({ startIndex, currentIndex });

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
        } else if (
          delayComplete &&
          text?.length > currentIndex &&
          maxCharacters > currentIndex - startIndex.current
        ) {
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

    let displayText = useMemo(() => {
      return text.substring(startIndex.current, currentIndex);
    }, [startIndex.current, currentIndex, text]);

    return (
      <p className={'inline-block font-pixel text-base pb-16'}>{displayText}</p>
    );
  }
);

TypingText.displayName = 'TypingText';

export default TypingText;
