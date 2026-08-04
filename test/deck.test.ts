/**
 * The deck's pure functions. The one that matters is `shuffleArray`: it mutates
 * its argument and returns it, so a caller who treats it as pure loses the
 * order of the array it was handed. That contract is kept, and pinned here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  cardsByIds,
  createTarotDeck,
  shuffleArray,
} from '@/server/handlers/deck';
import { TarotDeck } from '@/server/data/tarot-deck';

const drawHand = () => createTarotDeck().slice(0, 5);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shuffleArray', () => {
  it('returns the same array object it was given', () => {
    const input = [1, 2, 3, 4];
    expect(shuffleArray(input)).toBe(input);
  });

  it('mutates its argument rather than copying it', () => {
    // Fisher-Yates with random pinned to 0 walks every element down to index 0,
    // which reverses the array — so the mutation is visible, not incidental.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const input = [1, 2, 3, 4];
    shuffleArray(input);
    expect(input).toEqual([2, 3, 4, 1]);
  });

  it('preserves the multiset of elements', () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    expect([...shuffleArray([...input])].sort((a, b) => a - b)).toEqual(input);
  });

  it('leaves a single-element array alone', () => {
    expect(shuffleArray(['only'])).toEqual(['only']);
  });
});

describe('createTarotDeck', () => {
  it('returns all 78 cards exactly once', () => {
    const deck = createTarotDeck();
    expect(deck).toHaveLength(78);
    expect(new Set(deck.map(card => card.id)).size).toBe(78);
  });

  it('does not shuffle the module-level TarotDeck', () => {
    const before = TarotDeck.map(card => card.id);
    createTarotDeck();
    createTarotDeck();
    expect(TarotDeck.map(card => card.id)).toEqual(before);
  });

  it('orders the deck differently across calls', () => {
    const ids = () => createTarotDeck().map(card => card.id);
    const first = ids();
    // 78! orderings; a repeat across four draws is not a thing that happens.
    const repeated = [ids(), ids(), ids()].every(
      order => JSON.stringify(order) === JSON.stringify(first)
    );
    expect(repeated).toBe(false);
  });
});

describe('the dealt hand', () => {
  it('is five distinct cards drawn from the deck', () => {
    const hand = drawHand();
    expect(hand).toHaveLength(5);
    expect(new Set(hand.map(card => card.id)).size).toBe(5);
    for (const card of hand) {
      expect(TarotDeck).toContainEqual(card);
    }
  });
});

describe('cardsByIds', () => {
  it('rehydrates cards in the order the ids were given', () => {
    const cards = cardsByIds([5, 1, 40]);
    expect(cards?.map(card => card.id)).toEqual([5, 1, 40]);
    expect(cards?.every(card => card.name && card.image)).toBe(true);
  });

  it('returns null when any id is unknown', () => {
    expect(cardsByIds([1, 999])).toBeNull();
  });

  it('returns an empty array for no ids', () => {
    expect(cardsByIds([])).toEqual([]);
  });
});
