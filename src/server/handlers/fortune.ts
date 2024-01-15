import { CardType } from "@/types";
import { createTarotDeck } from "./deck";
import OpenAI from "openai";
import { mockResponse } from "../data/mock-response";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY, // defaults to process.env["OPENAI_API_KEY"]
});

const generateFortunePrompt = (tarotHand: CardType[]) => {
  const cardString = tarotHand
    .map((card: CardType) => {
      return card?.name;
    })
    .join(", ");

  const prompt = `
    Please provide a detailed and insightful fortune reading based on a draw of 6 tarot cards.
    Interpret the cards in the context of the querent's life and current situation, offering guidance and insights that can help them navigate their path ahead.
    The cards drawn are as follows: ${cardString}.
    Provide a comprehensive reading that covers the past, present, and future aspects, along with any symbolism, emotions, or messages conveyed by the cards.
    Ensure the reading is both informative and inspiring, offering practical advice and guidance for the querent.
  `;

  return prompt;
};

export const generateMockFortune = async (tarotHand?: CardType[]) => {
  try {
    await setTimeout(() => {}, 1000);
    const mockFortune = mockResponse?.content;
    return mockFortune;
  } catch (error: any) {
    throw error;
  }
};

export const generateFortune = async (tarotHand?: CardType[]) => {
  try {
    if (!tarotHand) {
      tarotHand = createTarotDeck().slice(0, 5);
    }

    const prompt = generateFortunePrompt(tarotHand);

    console.log("starting api call to chat gpt:");
    const response = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
    });

    const fortuneReading = response?.choices?.[0]?.message?.content;
    return fortuneReading;
  } catch (error: any) {
    throw error;
  }
};
