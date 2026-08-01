'use client';
import { useEffect, useState } from 'react';
import CardTable from '../_components/CardTable';
import DialogBox from '../_components/DialogBox';
import { trpc } from '../_trpc/client';
import { CardType } from '@/types';

export default function Home() {
  const [fetchHand, setFetchHand] = useState<boolean>(false);
  const [showDialogBox, setShowDialogBox] = useState<boolean>(false);
  const [stateIndex, setStateIndex] = useState<number>(0);
  const [tarotHand, setTarotHand] = useState<CardType[]>([]);
  const [readingToken, setReadingToken] = useState<string>('');
  const [allRevealed, setAllRevealed] = useState<boolean>(false);

  // Dealing reserves API budget server-side, so it is a mutation: the query
  // cache must never refetch or replay it.
  const { mutate: deal } = trpc.dealHand.useMutation({
    onSuccess: data => {
      setTarotHand(data.hand);
      setReadingToken(data.token);
      setAllRevealed(false);
    },
  });

  useEffect(() => {
    if (fetchHand) {
      setFetchHand(false);
      deal();
    }
  }, [fetchHand, deal]);

  const resetData = () => {
    setTarotHand([]);
    setReadingToken('');
  };

  useEffect(() => {
    setTimeout(() => {
      setShowDialogBox(true);
    }, 2000);
  });

  return (
    <main className="justify-between">
      <CardTable tarotHand={tarotHand} setAllRevealed={setAllRevealed} />
      <div className="absolute bottom-4 left-0 w-[100%] px-6 lg:px-[200px] flex flex-1">
        {showDialogBox && (
          <DialogBox
            allRevealed={allRevealed}
            tarotHand={tarotHand}
            readingToken={readingToken}
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
