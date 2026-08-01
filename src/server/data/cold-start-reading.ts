/**
 * The one reading in the app that is not AI-authored, reachable only if the cap
 * is reached while the cache is empty — which takes a month whose very first
 * draw both exhausts the budget and fails to store a reading. The cache is
 * written by the first successful generation, so in practice this is dead
 * ground; it exists so that case is defined rather than a dead dialog.
 *
 * Written to name no cards, so it stays coherent against any spread on the
 * table and needs nothing from ticket #17's card descriptions.
 */
export const COLD_START_READING = `The deck has been laid, but the spirits are keeping their counsel tonight. The cards before you are true — they were drawn for you, and they are yours — yet the voice that reads them has gone quiet for a while, the way an oracle falls silent when it has spoken too long without rest.

Sit with the spread anyway. Look at what came up, in the order it came up, and ask what you already suspected before you dealt. The tarot has never been in the business of telling you something you did not know; it is in the business of making you admit it. The pictures do that work with or without a voice over them.

Come back when the moon has turned. The words will have returned by then, and the cards will still be willing to talk.`;
