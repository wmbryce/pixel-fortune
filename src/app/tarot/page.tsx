"use client";
import { useEffect, useState } from "react";
import CardTable from "../_components/CardTable";
import Welcome from "../_components/Welcome";
import DialogBox from "../_components/DialogBox";
import PageHeader from "../_components/PageHeader";
import { trpc } from "../_trpc/client";

export default function Home() {
  const [fetchHand, setFetchHand] = useState<boolean>(false);
  const [showDialogBox, setShowDialogBox] = useState<boolean>(false);

  const getTarotHand = trpc.getTarotHand.useQuery(undefined, {
    enabled: fetchHand,
  });

  useEffect(() => {
    setTimeout(() => {
      setShowDialogBox(true);
    }, 2000);
  });

  return (
    <main className="flex flex-1 flex-col justify-between">
      <CardTable tarotHand={getTarotHand?.data} />
      {showDialogBox && (
        <DialogBox fetchHand={fetchHand} setFetchHand={setFetchHand} />
      )}
    </main>
  );
}
