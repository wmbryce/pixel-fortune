import React, { useEffect, useState } from "react";
import { DialogButton } from "./DialogButton";
import { start } from "repl";

type Props = {
  text: string;
  delay: number;
  nextAction: 
};

function TypingText({ text, delay, nextAction }: Props) {
  const [startIndex, setStartIndex] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [delayComplete, setDelayComplete] = useState<boolean>(false);
  const [showContinueButton, setShowContinueButton] = useState<boolean>(false);

  const typingInterval = 30;
  const maxCharacters = 1000;

  console.log("delayComplete ", {
    delayComplete,
    textLength: text?.length,
    currentIndex,
    maxCharacters,
    currentIndex,
    startIndex,
  });

  useEffect(() => {
    if (
      delayComplete &&
      text?.length > currentIndex &&
      maxCharacters > currentIndex - startIndex
    ) {
      setTimeout(() => { 
        setCurrentIndex(currentIndex + 1);
      }, typingInterval);
    } else if (maxCharacters === currentIndex - startIndex) {
        setShowContinueButton(true)
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
    <>
      <p className={"font-sans"}>{text.substring(startIndex, currentIndex)}</p>
      {showContinueButton && (
        <DialogButton onClick={ClearAndContinue}>Continue</DialogButton>
      )}
    </>
  );
}

export default TypingText;
