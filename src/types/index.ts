export type CardType = {
  id: number;
  image: string;
  name: string;
};

export type TarotHandType = CardType[];

/**
 * How many cards a hand holds. The server deals it and every other reader
 * derives from the hand it is actually handed — `CardTable` from
 * `tarotHand.length`, the prompt from the cards it names — so this constant is
 * consulted in exactly two places: the deal itself, and the layout `CardTable`
 * reserves *before* a hand exists, which has nothing to measure yet.
 *
 * It lives in the shared types module because it is the one fact the client and
 * the server both need and neither owns; `src/server` cannot be imported from a
 * client component, and a second copy on the client is the drift this replaces.
 *
 * Two ceilings bound it. The deck is 78 cards (`data/tarot-deck.ts`), which is
 * not the binding one: `CardTable` deals a card every 260ms and settles 250ms
 * later, and that has to finish inside the dialog's 2200ms `REVEAL_BEAT_MS` or
 * the box asks for the first card while the hand is still landing. Six cards
 * lands at 1810ms; seven would still fit at 2070ms, eight would not.
 */
export const HAND_SIZE = 6;
