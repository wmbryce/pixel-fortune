'use client';
import { useCallback, useEffect, useState } from 'react';
import CardTable from '../_components/CardTable';
import DialogBox from '../_components/DialogBox';
import { trpc } from '../_trpc/client';
import { CardType } from '@/types';

/** The box arrives after the table, so the two do not slide in on top of each other. */
const DIALOG_ENTRANCE_MS = 2000;

/** Stable identity: `CardTable` resets its deal whenever the hand it holds changes. */
const NO_HAND: CardType[] = [];

export default function Home() {
  const [showDialogBox, setShowDialogBox] = useState<boolean>(false);
  const [tarotHand, setTarotHand] = useState<CardType[]>(NO_HAND);
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

  // Was an effect with no dependency array, opening a fresh timer on every
  // render for the whole life of the page.
  useEffect(() => {
    const t = setTimeout(() => setShowDialogBox(true), DIALOG_ENTRANCE_MS);
    return () => clearTimeout(t);
  }, []);

  const draw = useCallback(() => deal(), [deal]);
  const reset = useCallback(() => {
    setTarotHand(NO_HAND);
    setReadingToken('');
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <CardTable tarotHand={tarotHand} setAllRevealed={setAllRevealed} />
      {/* The dialog is a sibling of the card area, not an overlay on it: at its
          256px height it used to bury the bottom of the spread on a phone
          (#14). The strip is reserved from the start — 256px plus the box's own
          `mt-6` plus this strip's `pb-3` — so opening it never resizes the
          cards. */}
      <div className="h-[292px] shrink-0 px-3 pb-3 flex lg:px-[200px]">
        {showDialogBox && (
          <DialogBox
            allRevealed={allRevealed}
            readingToken={readingToken}
            onDraw={draw}
            onReset={reset}
          />
        )}
      </div>
    </div>
  );
}
