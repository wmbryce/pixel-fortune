import { CardType } from "@/types";
import { TarotDeck } from "../data/tarot-deck";

export const createTarotDeck = () => {
  const newTarotDeck = [...TarotDeck];
  return shuffleArray(newTarotDeck);
};

const byId = new Map(TarotDeck.map((card) => [card.id, card]));

/**
 * Rehydrates an ordered spread from card ids. Cached readings store ids rather
 * than card objects so a replay always renders against the current deck —
 * ticket #17 is still filling in the 78 descriptions, and a reading cached
 * today should show them once it lands. Returns null if any id is unknown.
 */
export const cardsByIds = (ids: number[]): CardType[] | null => {
  const cards = ids.map((id) => byId.get(id));
  return cards.every((card): card is CardType => !!card)
    ? (cards as CardType[])
    : null;
};

function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    // Generate a random index between 0 and i (inclusive)
    const j = Math.floor(Math.random() * (i + 1));

    // Swap elements at i and j
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
