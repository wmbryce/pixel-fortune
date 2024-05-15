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
  tarotHand: any;
  fetchHand: boolean;
  setFetchHand: Dispatch<SetStateAction<boolean>>;
  resetData: any;
  stateIndex: number;
  setStateIndex: any;
};

function DialogBox({
  tarotHand,
  fetchHand,
  setFetchHand,
  resetData,
  stateIndex,
  setStateIndex,
}: Props) {
  const [skip, setSkip] = useState<any>(false);
  const [typingComplete, setTypingComplete] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const {
    mutate: fetchFortune,
    isLoading,
    data,
    variables,
  } = trpc.getFortune.useMutation({
    onSettled: (data) => {
      let textArray: string[] = [];
      if (typeof data === "string") {
        textArray = data?.split(/\n\s*\n+/);
        console.log("splitting text into an array: ", textArray);
      }
      setDialogStates(generateTableStates(textArray));
      // setStateIndex(0);
    },
  });

  const startState = [
    {
      label: "Draw Hand",
      body: WELCOME_MESSAGE,
      action: () => {
        setFetchHand(true);
        // setStateIndex(1);
      },
    },
  ];

  const [dialogStates, setDialogStates] =
    useState<tableStateType[]>(startState);

  const generateTableStates = (textArray: string[]): tableStateType[] => {
    const mid = textArray.map((text, index) => {
      return {
        label: "Continue",
        body: text,
        action: () => {
          setStateIndex(index + 1);
        },
      };
    });
    const tail = [
      {
        label: "Reset",
        body: RESET_MESSAGE,
        action: () => {
          setDialogStates(startState);
          setStateIndex(0);
          resetData();
        },
      },
    ];

    return [...mid, ...tail];
  };

  useEffect(() => {
    if (tarotHand.length === 5) {
      fetchFortune(tarotHand);
    }
  }, [tarotHand]);

  useEffect(() => {
    const dialogButton = document.getElementById("dialogButton");
    const nextKeyPress = () => {
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
