"use client";
import { useEffect, useState } from "react";
import CardTable from "../_components/CardTable";
// import Welcome from "../_components/Welcome";
import DialogBox from "../_components/DialogBox";
// import PageHeader from "../_components/PageHeader";
import { trpc } from "../_trpc/client";
import { CardType } from "@/types";

export default function Home() {
  const [fetchHand, setFetchHand] = useState<boolean>(false);
  const [showDialogBox, setShowDialogBox] = useState<boolean>(false);
  const [stateIndex, setStateIndex] = useState<number>(0);
  const [tarotHand, setTarotHand] = useState<CardType[]>([]);
  const [allRevealed, setAllRevealed] = useState<boolean>(false);

  console.log("All Revealed: ", allRevealed);
  const getTarotHand = trpc.getTarotHand.useQuery(undefined, {
    enabled: fetchHand,
    onSuccess: (data) => {
      setTarotHand(data);
      setFetchHand(false);
      setAllRevealed(false);
    },
  });

  const resetData = () => {
    setTarotHand([]);
  };

  useEffect(() => {
    setTimeout(() => {
      setShowDialogBox(true);
    }, 2000);
  });

  return (
    <main className="flex flex-1 flex-col justify-between">
      <CardTable tarotHand={tarotHand} setAllRevealed={setAllRevealed} />
      <div className="bottom-0 left-0 w-[100%] px-6 lg:px-[200px]">
        {showDialogBox && (
          <DialogBox
            allRevealed={allRevealed}
            tarotHand={tarotHand}
            fetchHand={fetchHand}
            setFetchHand={setFetchHand}
            stateIndex={stateIndex}
            setStateIndex={setStateIndex}
            resetData={resetData}
          />
        )}
      </div>
    </main>
  );
}
