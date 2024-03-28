import React, { use, useEffect, useState } from "react";
import { DialogButton } from "./DialogButton";

type Props = {
  text: string;
  delay: number;
  skip: boolean;
};

function TypingText({ text, delay, skip }: Props) {
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
    if (
      delayComplete &&
      text?.length > currentIndex &&
      maxCharacters > currentIndex - startIndex
    ) {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
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
