import type { AIService, ChatMessage } from "../types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const openrouterService: AIService = {
  name: `OpenRouter (${OPENROUTER_MODEL})`,
  chat: async function* (messages: ChatMessage[]) {
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost",
        "X-Title": process.env.OPENROUTER_SITE_NAME || "Bun AI Load Balancer",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`);
    }

    if (!response.body) {
      throw new Error("OpenRouter: empty response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep last (possibly incomplete) line in buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Process any remaining buffer content
      if (buffer.trim() && buffer.trim() !== "data: [DONE]" && buffer.trim().startsWith("data: ")) {
        try {
          const json = JSON.parse(buffer.trim().slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // ignore
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};
