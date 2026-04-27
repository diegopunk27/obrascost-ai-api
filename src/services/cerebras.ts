import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { AIService, ChatMessage } from "../types";
import { ChatCompletionChunk } from "groq-sdk/lib/chat_completions_ext.mjs";

const client = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || "gpt-oss-120b";

export const cerebrasService: AIService = {
  name: `Cerebras (${CEREBRAS_MODEL})`,
  chat: async function* (messages: ChatMessage[]) {
    const chatCompletion = await client.chat.completions.create({
      messages: messages as any,
      model: CEREBRAS_MODEL,
      stream: true,
    });

    for await (const chunk of chatCompletion) {
      const content = (chunk as any as ChatCompletionChunk).choices[0]?.delta?.content || "";
      if (content) yield content;
    }
  }
};