import { CardType } from "@/types";
import { createTarotDeck } from "./deck";
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

export const generateFortune = async (tarotHand?: CardType[]) => {
  const hand = tarotHand ?? createTarotDeck().slice(0, 5);

  const response = await getOpenAIClient().chat.completions.create({
    messages: [{ role: "user", content: generateFortunePrompt(hand) }],
    model: "gpt-3.5-turbo-16k",
  });

  return response?.choices?.[0]?.message?.content;
};
