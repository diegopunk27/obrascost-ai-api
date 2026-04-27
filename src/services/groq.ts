import Groq from "groq-sdk";
import type { AIService, ChatMessage } from "../types";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || "moonshotai/kimi-k2-instruct-0905";

export const groqService: AIService = {
  name: `Groq (${GROQ_MODEL})`,
  chat: async function* (messages: ChatMessage[]) {
    const chatCompletion = await client.chat.completions.create({
      messages: messages as any,
      model: GROQ_MODEL,
      stream: true,
    });

    for await (const chunk of chatCompletion) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) yield content;
    }
  }
};