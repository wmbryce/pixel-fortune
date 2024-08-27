import React, { SetStateAction, use, useEffect, useState } from "react";
import { DialogButton } from "./DialogButton";

type Props = {
  ref: any;
  text: string;
  delay: number;
  skip: boolean;
  setTypingComplete: any;
};

export const TypingText = React.forwardRef(({ text, delay, skip, setTypingComplete}: Props, ref: any) => {
  const [startIndex, setStartIndex] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [delayComplete, setDelayComplete] = useState<boolean>(false);

  const typingInterval = 15;
  const maxCharacters = 1000;

  useEffect(() => {
    setCurrentIndex(0);
    setStartIndex(0);
  }, [text]);

  const scrollToBottom = () => {
    if (ref?.current) {
      ref.current.scrollTop = ref.current.scrollHeight + 10;
    }
  };

  useEffect(() => {
    if (skip) {
      setCurrentIndex(text?.length);
      setTypingComplete(false);
    } else if (
      delayComplete &&
      text?.length > currentIndex &&
      maxCharacters > currentIndex - startIndex
    ) {
      setTypingComplete(false);
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        scrollToBottom();
        if (currentIndex + 1 === text?.length) {
          setTypingComplete(true);
        }
      }, typingInterval);
    } else {
      setTimeout(() => {
        setDelayComplete(true);
      }, delay);
    }
  });

  const ClearAndContinue = () => {
    setStartIndex(currentIndex);
  };

  return (
    <p className={"font-sans"}>{text.substring(startIndex, currentIndex) + "                   "}</p>
  );
})

TypingText.displayName = "TypingText";

export default TypingText;
