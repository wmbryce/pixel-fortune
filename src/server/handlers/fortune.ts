import { CardType } from "@/types";
import { config } from "../config";
import OpenAI from "openai";

let openai: OpenAI;

function getOpenAIClient() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export const FORTUNE_MODEL = "gpt-4o-mini";

/**
 * The reading's shape is load-bearing, not stylistic: the dialog box splits on
 * blank lines and pages one paragraph at a time through a 30ms/char typewriter.
 * So the prompt bounds the reading *by construction* — a fixed paragraph count,
 * a per-paragraph length that types out in a readable span, and no markdown,
 * which would page as literal `##` in a pixel dialog box.
 *
 * That bound is also the token budget: 4 paragraphs x ~600 characters is
 * ~600 output tokens, comfortably under `config.maxOutputTokens`.
 */
const generateFortunePrompt = (tarotHand: CardType[]) => {
  const cardString = tarotHand.map((card: CardType) => card?.name).join(", ");

  return `
    You are a tarot reader giving a detailed, insightful reading from a draw of 5 cards.
    The cards drawn, in order, are: ${cardString}.

    Cover the past, the present, and the future, drawing on the symbolism, emotions,
    and messages of the cards named above, and close with practical guidance for the
    querent. Be informative and inspiring, and speak directly to the querent.

    Format requirements, which the reading must follow exactly:
    - Exactly 4 paragraphs: past, present, future, guidance.
    - Separate paragraphs with a blank line.
    - Keep every paragraph under 600 characters.
    - Plain prose only: no markdown, no headings, no lists, no titles.
  `;
};

export type GeneratedFortune = {
  reading: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
};

/**
 * Trims a completion the model did not finish to its last complete sentence.
 *
 * Reaching the token ceiling should not happen — the prompt asks for a reading
 * roughly 15% shorter than the ceiling allows — but if it does, the visitor
 * would otherwise be paged a sentence that stops mid-word. Losing text is the
 * bug this ticket exists to kill, so the drop is logged rather than swallowed.
 */
const trimUnfinished = (reading: string) => {
  const lastStop = Math.max(
    reading.lastIndexOf(". "),
    reading.lastIndexOf(".\n"),
    reading.trimEnd().endsWith(".") ? reading.trimEnd().length - 1 : -1
  );
  console.warn(
    `generateFortune: completion hit max_completion_tokens (${config.maxOutputTokens}); trimming an unfinished sentence`
  );
  return lastStop > 0 ? reading.slice(0, lastStop + 1) : reading;
};

/**
 * One live generation. `max_completion_tokens` is the second half of the spend
 * cap: the reservation assumes a bounded completion, so the request has to
 * enforce that bound.
 *
 * The hand is required: it always comes from the server-side hold, never from
 * the client.
 */
export const generateFortune = async (
  tarotHand: CardType[]
): Promise<GeneratedFortune | null> => {
  const response = await getOpenAIClient().chat.completions.create({
    messages: [{ role: "user", content: generateFortunePrompt(tarotHand) }],
    model: FORTUNE_MODEL,
    max_completion_tokens: config.maxOutputTokens,
  });

  const choice = response?.choices?.[0];
  const reading = choice?.message?.content;
  if (!reading) return null;

  return {
    reading:
      choice.finish_reason === "length" ? trimUnfinished(reading) : reading,
    model: response.model ?? FORTUNE_MODEL,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    },
  };
};
