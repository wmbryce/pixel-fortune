"use client";

import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import { trpc } from "../../_trpc/client";
import { DialogButton } from "../DialogButton";
import "./background.css";
import { RESET_MESSAGE, WELCOME_MESSAGE } from "./data";
import TypingText from "../TypingText";

type tableStateType = {
  label: string;
  body: string;
  action: any;
};

type Props = {
  fetchHand: boolean;
  setFetchHand: Dispatch<SetStateAction<boolean>>;
  resetData: any;
  stateIndex: number;
  setStateIndex: any;
};

function DialogBox({
  fetchHand,
  setFetchHand,
  resetData,
  stateIndex,
  setStateIndex,
}: Props) {
  //   let [stateIndex, setStateIndex] = useState<number>(0);
  //   const currentState = useRef<number>(0);
  const [skip, setSkip] = useState<any>(false);
  const [typingComplete, setTypingComplete] = useState<boolean>(false);

  const {
    mutate: fetchFortune,
    isLoading,
    data,
  } = trpc.getFortune.useMutation({
    onSettled: (data) => {
      let textArray: string[] = [];
      if (typeof data === "string") {
        textArray = data?.split(/\n\s*\n+/);
        console.log("splitting text into an array: ", textArray);
      }
      setDialogStates(generateTableStates(textArray));
      setStateIndex(2);
    },
  });

  const generateTableStates = (textArray: string[]): tableStateType[] => {
    const head = [
      {
        label: "Draw Hand",
        body: WELCOME_MESSAGE,
        action: () => {
          setFetchHand(true);
          setStateIndex(1);
        },
      },
      {
        label: "Generate Fortune",
        body: WELCOME_MESSAGE,
        action: () => {
          fetchFortune();
        },
      },
    ];

    const mid = textArray.map((text, index) => {
      return {
        label: "Continue",
        body: text,
        action: () => {
          console.log("setting state to: ", index + 3);
          setStateIndex(index + 3);
        },
      };
    });

    const tail = [
      {
        label: "Reset",
        body: RESET_MESSAGE,
        action: () => {
          setStateIndex(0);
          resetData();
        },
      },
    ];

    return [...head, ...mid, ...tail];
  };

  const [dialogStates, setDialogStates] = useState<tableStateType[]>(
    generateTableStates([])
  );

  useEffect(() => {
    const dialogButton = document.getElementById("dialogButton");
    const nextKeyPress = () => {
      console.log(" in nextKeyPress: ", { skip, typingComplete });
      if (!skip && !typingComplete) {
        setSkip(true);
      } else {
        dialogStates?.[stateIndex]?.action();
        setSkip(false);
      }
    };
    window.addEventListener("keydown", nextKeyPress);
    dialogButton?.addEventListener("click", nextKeyPress);
    return () => {
      window.removeEventListener("keydown", nextKeyPress);
      dialogButton?.removeEventListener("click", nextKeyPress);
    };
  }, [stateIndex, skip, dialogStates, typingComplete]);

  //   console.log("typingComplete:", typingComplete);

  return (
    <div className="relative animate-fadeIn flex flex-col flex-1 w-[100%] items-center opacity-[90%]">
      <div className="dialog-background flex flex-col h-[360px] w-[100%] p-8 border bg-brown_02 border-brown_01 border-8 text-brown_03 overflow-scroll rounded-md my-6">
        <TypingText
          text={dialogStates?.[stateIndex]?.body}
          delay={1000}
          skip={skip}
          setTypingComplete={setTypingComplete}
        />
        <div className="absolute bottom-8 right-16">
          <DialogButton id={"dialogButton"} loading={isLoading}>
            {dialogStates?.[stateIndex]?.label}
          </DialogButton>
        </div>
      </div>
    </div>
  );
}

export default DialogBox;
