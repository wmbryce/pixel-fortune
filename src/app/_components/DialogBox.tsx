import React from "react";
import { trpc } from "../_trpc/client";
import { DialogButton } from "./DialogButton";

function DialogBox() {
  const getFortune = trpc.getFortune.useMutation();

  console.log("getFortune: ", getFortune);

  return (
    <div className="h-[360px] p-8 w-[80%] border bg-brown_02 border-brown_01 border-8 text-brown_03 overflow-scroll rounded-md">
      {getFortune?.isLoading ? (
        <p>Loading... </p>
      ) : (
        getFortune?.data && (
          <p className="animation-type font-sans">{getFortune?.data}</p>
        )
      )}
      {(getFortune?.isSuccess || getFortune?.isError || getFortune?.isIdle) && (
        <DialogButton
          onClick={() => {
            getFortune.mutate();
          }}
        >
          {getFortune?.isIdle ? "Generate" : "Regenerate"} Fortune
        </DialogButton>
      )}
    </div>
  );
}

export default DialogBox;
