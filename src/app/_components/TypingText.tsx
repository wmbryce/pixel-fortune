import React, { SetStateAction, use, useEffect, useState } from "react";
import { DialogButton } from "./DialogButton";

type Props = {
  text: string;
  delay: number;
  skip: boolean;
  setTypingComplete: any;
};

function TypingText({ text, delay, skip, setTypingComplete }: Props) {
  const [startIndex, setStartIndex] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [delayComplete, setDelayComplete] = useState<boolean>(false);

  const typingInterval = 15;
  const maxCharacters = 1000;

  useEffect(() => {
    setCurrentIndex(0);
    setStartIndex(0);
  }, [text]);

  useEffect(() => {
    if (skip) {
      setCurrentIndex(text?.length);
    } else if (
      delayComplete &&
      text?.length > currentIndex &&
      maxCharacters > currentIndex - startIndex
    ) {
      setTypingComplete(false);
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
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
    <p className={"font-sans"}>{text.substring(startIndex, currentIndex)}</p>
  );
}

export default TypingText;
