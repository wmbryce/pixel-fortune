import React, { Dispatch, SetStateAction } from "react";
import { trpc } from "../_trpc/client";
import { DialogButton } from "./DialogButton";

type Props = {
  fetchHand: boolean;
  setFetchHand: Dispatch<SetStateAction<boolean>>;
};

function DialogBox({ fetchHand, setFetchHand }: Props) {
  const getFortune = trpc.getFortune.useMutation();

  console.log("getFortune: ", { getFortune, fetchHand });

  return (
    <div className="h-[360px] p-8 w-[80%] border bg-brown_02 border-brown_01 border-8 text-brown_03 overflow-scroll rounded-md my-6">
      {getFortune?.isLoading ? (
        <p>Loading... </p>
      ) : (
        getFortune?.data && (
          <p className="animation-type font-sans">{getFortune?.data}</p>
        )
      )}
      {}
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
  );
}

export default DialogBox;
