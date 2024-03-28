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
  const [tarotHand, setTarotHand] = useState<CardType[]>([]);

  const getTarotHand = trpc.getTarotHand.useQuery(undefined, {
    enabled: fetchHand,
    onSuccess: (data) => {
      setTarotHand(data);
      setFetchHand(false);
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

  // console.log("fetch hand: ", fetchHand, getTarotHand?.data);

  return (
    <main className="flex flex-1 flex-col justify-between">
      <CardTable tarotHand={tarotHand} />
      <div className="absolute bottom-0 left-0 w-[100%] px-[200px]">
        {showDialogBox && (
          <DialogBox
            fetchHand={fetchHand}
            setFetchHand={setFetchHand}
            resetData={resetData}
          />
        )}
      </div>
    </main>
  );
}
