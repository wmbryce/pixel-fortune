"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, Dispatch, SetStateAction } from "react";
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

  const scrollRef = useRef<any>(null);

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
      if (!isLoading && !hideAll && !hideDialog) {
        if (!skip && !typingComplete) {
          setSkip(true);
          setErrorText(null);
        } else {
          if (!allRevealed && tarotHand.length === 5) {
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


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scrollRef?.current?.scrollHeight]);

  const loadingDots = [1, 2, 3];

  return (
    <AnimatePresence>
      {hideAll ? null : hideDialog || isLoading ? (
        <motion.div
          layoutId={"dialog-box"}
          initial={{ y: "200%", width: "0%" }}
          animate={{ y: "0%", width: "100%" }}
          exit={{ y: "200%", width: "0%" }}
          transition={{ duration: 1, type: "spring" }}
          className="relative flex flex-col flex-1 w-[100%] items-center opacity-[90%]"
        >
          <div className="dialog-background flex flex-col h-[50px] w-[100%] border bg-brown_02 border-brown_01 border-8 text-brown_03 overflow-scroll rounded-md my-6">
            {isLoading && (
              <motion.div
                className="mx-[50%] my-[5px] h-[20px] w-[20px] bg-brown_01"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ repeat: Infinity, type: "spring", duration: 1 }}
              />)}
          </div>
        </motion.div>
      ) : (
        <motion.div
          layoutId={"dialog-box"}
          className="relative flex flex-col flex-1 w-[100%] h-[64] items-center opacity-[90%]"
          transition={{ delay:2, duration: 1, type: "spring" }}
        >
          <div className="dialog-background flex flex-col justify-between h-64 w-[100%] border bg-brown_02 border-brown_01 border-8 text-brown_03 overflow-y-scroll rounded-md mt-6">
            <div ref={scrollRef} className="flex px-8 pt-8 pb-16 overflow-y-auto">
            <TypingText
              ref={scrollRef}
              text={dialogStates?.[stateIndex]?.body}
              delay={1000}
              skip={skip}
              setTypingComplete={setTypingComplete}
            />
            </div>
            <AnimatePresence>
              {(skip || typingComplete) && 
                <motion.div 
                  initial={{ opacity: 0, y: "100%" }}
                  animate={{ opacity: 1, y: "0%" }}
                  exit={{ opacity: 0, y: "100%" }}
                  className="flex flex-row items-center border-t-[2px] border-brown_01 justify-end bg-[#FFFFFF00] p-2 text-brown_02 font-sans"
                  transition={{ duration: 2, type: "spring" }}
                >
                {true && <div className="font-sans mr-4">{errorText}</div>}
                <DialogButton id={"dialogButton"} loading={isLoading}>
                  {dialogStates?.[stateIndex]?.label}
                </DialogButton>
              </motion.div>}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DialogBox;
