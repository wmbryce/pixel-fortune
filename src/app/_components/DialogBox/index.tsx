import React, { Dispatch, SetStateAction } from "react";
import { trpc } from "../../_trpc/client";
import { DialogButton } from "../DialogButton";
import "./background.css";
import { WELCOME_MESSAGE } from "./data";
import TypingText from "../TypingText";

type Props = {
  fetchHand: boolean;
  setFetchHand: Dispatch<SetStateAction<boolean>>;
};

function DialogBox({ fetchHand, setFetchHand }: Props) {
  const getFortune = trpc.getFortune.useMutation();

  return (
    <div className="animate-fadeIn flex flex-col flex-1 w-[100%] items-center opacity-[90%] px-4 mt-12">
      <div className="dialog-background flex flex-col h-[360px] w-[100%] p-8 border bg-brown_02 border-brown_01 border-8 text-brown_03 overflow-scroll rounded-md my-6">
        {getFortune?.isLoading ? (
          <p>Loading... </p>
        ) : getFortune?.data ? (
          <TypingText text={getFortune?.data} delay={0} />
        ) : (
          <TypingText text={WELCOME_MESSAGE} delay={1000} />
        )}
        {fetchHand ? (
          (getFortune?.isSuccess ||
            getFortune?.isError ||
            getFortune?.isIdle) && (
            <DialogButton
              onClick={() => {
                getFortune.mutate();
              }}
            >
              {getFortune?.isIdle ? "Generate" : "Regenerate"} Fortune
            </DialogButton>
          )
        ) : (
          <DialogButton
            onClick={() => {
              setFetchHand(true);
            }}
          >
            Draw Hand
          </DialogButton>
        )}
      </div>
    </div>
  );
}

export default DialogBox;
