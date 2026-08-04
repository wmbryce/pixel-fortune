import { CardType } from '@/types';
import { TarotDeck } from '../data/tarot-deck';

export const createTarotDeck = () => {
  const newTarotDeck = [...TarotDeck];
  return shuffleArray(newTarotDeck);
};

const byId = new Map(TarotDeck.map(card => [card.id, card]));

/**
 * Rehydrates an ordered spread from card ids. Cached readings store ids rather
 * than card objects so a replay always renders against the current deck.
 * Returns null if any id is unknown.
 */
export const cardsByIds = (ids: number[]): CardType[] | null => {
  const cards = ids.map(id => byId.get(id));
  return cards.every((card): card is CardType => !!card)
    ? (cards as CardType[])
    : null;
};

/**
 * Shuffles in place **and** returns the same array — deliberately dual, and
 * pinned by `test/deck.test.ts`. `createTarotDeck` copies `TarotDeck` before
 * calling it; any other caller must do the same or lose its original order.
 */
export function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    // Generate a random index between 0 and i (inclusive)
    const j = Math.floor(Math.random() * (i + 1));

    // Swap elements at i and j
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
