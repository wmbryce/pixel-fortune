"use client";
import { useEffect, useState } from "react";
import CardTable from "../_components/CardTable";
import Welcome from "../_components/Welcome";
import DialogBox from "../_components/DialogBox";
import PageHeader from "../_components/PageHeader";
import { trpc } from "../_trpc/client";

export default function Home() {
  const [fetchHand, setFetchHand] = useState<boolean>(false);

  const getTarotHand = trpc.getTarotHand.useQuery(undefined, {
    enabled: fetchHand,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-black_01">
      <CardTable tarotHand={getTarotHand?.data} />
      <DialogBox fetchHand={fetchHand} setFetchHand={setFetchHand} />
    </main>
  );
}
