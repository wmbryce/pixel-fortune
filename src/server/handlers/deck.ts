import { TarotDeck } from "../data/tarot-deck";

export const createTarotDeck = () => {
  const newTarotDeck = [...TarotDeck];
  return shuffleArray(newTarotDeck);
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
