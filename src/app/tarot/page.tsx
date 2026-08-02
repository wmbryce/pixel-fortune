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
    <div className="flex min-h-0 flex-1 flex-col">
      <CardTable tarotHand={tarotHand} setAllRevealed={setAllRevealed} />
      {/* The dialog is a sibling of the card area, not an overlay on it: at its
          256px height it used to bury the bottom of the spread on a phone
          (#14). The strip is reserved from the start — 256px plus the box's own
          `mt-6` — so opening it never resizes the cards. */}
      <div className="h-[292px] shrink-0 px-3 pb-3 flex lg:px-[200px]">
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
    </div>
  );
}
