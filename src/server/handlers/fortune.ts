import { CardType } from "@/types";
import { createTarotDeck } from "./deck";
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

export const FORTUNE_MODEL = "gpt-3.5-turbo-16k";

const generateFortunePrompt = (tarotHand: CardType[]) => {
  const cardString = tarotHand
    .map((card: CardType) => {
      return card?.name;
    })
    .join(", ");

  const prompt = `
    Please provide a detailed and insightful fortune reading based on a draw of 5 tarot cards.
    Interpret the cards in the context of the querent's life and current situation, offering guidance and insights that can help them navigate their path ahead.
    The cards drawn are as follows: ${cardString}.
    Provide a comprehensive reading that covers the past, present, and future aspects, along with any symbolism, emotions, or messages conveyed by the cards.
    Ensure the reading is both informative and inspiring, offering practical advice and guidance for the querent.
  `;

  return prompt;
};

export type GeneratedFortune = {
  reading: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
};

/**
 * One live generation. `max_tokens` is the second half of the spend cap: the
 * reservation assumes a bounded completion, so the request has to enforce that
 * bound. Whoever changes the model (#12) may need the newer
 * `max_completion_tokens` spelling — the cap depends on one of the two being set.
 */
export const generateFortune = async (
  tarotHand?: CardType[]
): Promise<GeneratedFortune | null> => {
  const hand = tarotHand ?? createTarotDeck().slice(0, 5);

  const response = await getOpenAIClient().chat.completions.create({
    messages: [{ role: "user", content: generateFortunePrompt(hand) }],
    model: FORTUNE_MODEL,
    max_tokens: config.maxOutputTokens,
  });

  const reading = response?.choices?.[0]?.message?.content;
  if (!reading) return null;

  return {
    reading,
    model: response.model ?? FORTUNE_MODEL,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    },
  };
};
