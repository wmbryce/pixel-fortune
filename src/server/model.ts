/**
 * What a live reading is generated on, and the assumed bound on its prompt.
 *
 * A leaf module deliberately: the spend cap derives its reservation from these
 * two numbers via `pricing.ts`, and the generation handler reads `config.ts`, so
 * anything both of them need has to sit below both.
 */
export const FORTUNE_MODEL = 'gpt-4o-mini';

/**
 * The prompt bound the reservation is derived against. The real prompt is a
 * fixed template plus one name per card in the hand (`HAND_SIZE`, six today) —
 * comfortably under 300 tokens, and a card name costs a handful, so the ~100
 * tokens of headroom absorb a far larger hand than the deal's own timing does.
 * 400 is deliberately generous: over-estimating the prompt only ever
 * over-reserves, while a reservation smaller than the call can cost is what
 * breaks the cap.
 */
export const MAX_PROMPT_TOKENS = 400;
