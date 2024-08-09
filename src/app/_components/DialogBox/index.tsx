"use client";

import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import { trpc } from "../../_trpc/client";
import { DialogButton } from "../DialogButton";
import "./background.css";
import { RESET_MESSAGE, WELCOME_MESSAGE, REVEAL_MESSAGE } from "./data";
import TypingText from "../TypingText";
import { AnimatePresence, motion } from "framer-motion";
import Card from "../Card";
import { useRouter } from "next/navigation";

type tableStateType = {
  label: string;
  body: string;
  action: any;
};

type Props = {
  tarotHand: any;
  allRevealed: boolean;
  fetchHand: boolean;
  setFetchHand: Dispatch<SetStateAction<boolean>>;
  resetData: any;
  stateIndex: number;
  setStateIndex: any;
};

function DialogBox({
  tarotHand,
  allRevealed,
  fetchHand,
  setFetchHand,
  resetData,
  stateIndex,
  setStateIndex,
}: Props) {
  const [skip, setSkip] = useState<any>(false);
  const [typingComplete, setTypingComplete] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<null | string>(null);
  const [hideAll, setHideAll] = useState(true);
  const [hideDialog, setHideDialog] = useState(true);
  const router = useRouter();

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
  const reveal = {
    label: "Continue",
    body: REVEAL_MESSAGE,
    action: () => {
      setStateIndex(1);
      // setStateIndex(1);
    },
  };

  const [dialogStates, setDialogStates] =
    useState<tableStateType[]>(startState);

  const generateTableStates = (textArray: string[]): tableStateType[] => {
    const mid = textArray.map((text, index) => {
      return {
        label: "Continue",
        body: text,
        action: () => {
          setStateIndex(index + 2);
        },
      };
    });
    const tail = [
      {
        label: "Complete",
        body: RESET_MESSAGE,
        action: () => {
          setDialogStates(startState);
          setStateIndex(0);
          resetData();
          router.push("/welcome");
        },
      },
    ];

    return [reveal, ...mid, ...tail];
  };

  useEffect(() => {
    if (tarotHand.length === 5) {
      fetchFortune(tarotHand);
      setFetchHand(false);
      setDialogStates([reveal]);
    }
  }, [tarotHand]);

  useEffect(() => {
    const dialogButton = document.getElementById("dialogButton");
    const nextKeyPress = () => {
      console.log(
        "key press vars!",
        { isLoading, hideAll, hideDialog },
        !isLoading && !hideAll && !hideDialog
      );
      if (!isLoading && !hideAll && !hideDialog) {
        console.log("skip & typing complete: ", { skip, typingComplete });
        if (!skip && !typingComplete) {
          setSkip(true);
          setErrorText(null);
        } else {
          if (!allRevealed && tarotHand.length === 5) {
            console.log("allRevealed: ", { allRevealed, tarotHand });
            setErrorText(
              "You must reveal all the cards before you can continue!"
            );
          } else {
            dialogStates?.[stateIndex]?.action();
            setSkip(false);
            setErrorText(null);
          }
        }
      }
    };
    window.addEventListener("keydown", nextKeyPress);
    dialogButton?.addEventListener("click", nextKeyPress);
    return () => {
      window.removeEventListener("keydown", nextKeyPress);
      dialogButton?.removeEventListener("click", nextKeyPress);
    };
  }, [
    stateIndex,
    skip,
    dialogStates,
    typingComplete,
    hideAll,
    isLoading,
    hideDialog,
    allRevealed,
  ]);

  useEffect(() => {
    setTimeout(() => {
      setHideAll(false);
    }, 500);
    setTimeout(() => {
      setHideDialog(false);
    }, 1500);
  }, []);

  const loadingDots = [1, 2, 3];

  return (
    <AnimatePresence>
      {hideAll ? null : hideDialog || isLoading ? (
        <motion.div
          layoutId={"dialog-box"}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          exit={{ width: "0%" }}
          transition={{ duration: 1, type: "spring" }}
          className="relative flex flex-col flex-1 w-[100%] items-center opacity-[90%]"
        >
          <div className="dialog-background flex flex-col h-[50px] w-[100%] border bg-brown_02 border-brown_01 border-8 text-brown_03 overflow-scroll rounded-md my-6">
            {isLoading && (
              <motion.div
                className="mx-[50%] my-[5px] h-[20px] w-[20px] bg-brown_01"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ repeat: Infinity, type: "spring", duration: 1 }}
              />
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          layoutId={"dialog-box"}
          className="relative flex flex-col flex-1 w-[100%] items-center opacity-[90%]"
          transition={{ duration: 1, type: "spring" }}
        >
          <div className="dialog-background flex flex-col h-[360px] w-[100%] p-8 border bg-brown_02 border-brown_01 border-8 text-brown_03 overflow-scroll rounded-md my-6">
            <TypingText
              text={dialogStates?.[stateIndex]?.body}
              delay={1000}
              skip={skip}
              setTypingComplete={setTypingComplete}
            />
            <AnimatePresence>
              {skip || typingComplete}
              <motion.div className="delay-6 animation-fadeIn absolute bottom-8 right-16 flex flex-row items-center">
                {errorText && <div className="font-sans mr-4">{errorText}</div>}
                <DialogButton id={"dialogButton"} loading={isLoading}>
                  {dialogStates?.[stateIndex]?.label}
                </DialogButton>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DialogBox;
