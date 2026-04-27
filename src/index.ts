import { getNextService, services } from "./services";
import type { ChatMessage } from "./types";

const PORT = parseInt(process.env.PORT || "8080", 10);

// Helper to validate request body
function validateChatRequest(body: unknown): { valid: true; messages: ChatMessage[]; targetService?: string } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const { messages } = body as any;

  if (!Array.isArray(messages)) {
    return { valid: false, error: "messages must be an array" };
  }

  if (messages.length === 0) {
    return { valid: false, error: "messages array cannot be empty" };
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      return { valid: false, error: "Each message must be an object" };
    }
    if (!["user", "assistant", "system"].includes(msg.role)) {
      return { valid: false, error: `Invalid role: ${msg.role}. Must be 'user', 'assistant', or 'system'` };
    }
    if (typeof msg.content !== "string") {
      return { valid: false, error: "Message content must be a string" };
    }
  }

  const targetService = (body as any).targetService;
  return { valid: true, messages, targetService };
}

// Helper to create JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// Helper to create error response
function errorResponse(error: string, status = 400): Response {
  return jsonResponse({ error }, status);
}

// Create streaming response
async function createStreamingResponse(messages: ChatMessage[], targetService?: string): Promise<Response> {
  const service = getNextService(targetService);
  console.log(`[STREAM] Using service: ${service.name}`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of service.chat(messages)) {
          // Send the chunk as plain text
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error: any) {
        console.error(`[STREAM] Error in service ${service.name}:`, error);
        // Send error as JSON in the stream
        const errorChunk = JSON.stringify({ error: error.message || "Unknown error" });
        controller.enqueue(encoder.encode(`\n${errorChunk}\n`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      console.log("[STREAM] Client disconnected");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Transfer-Encoding": "chunked",
    },
  });
}

// Create complete (non-streaming) response
async function createCompleteResponse(messages: ChatMessage[], targetService?: string): Promise<Response> {
  const service = getNextService(targetService);
  console.log(`[COMPLETE] Using service: ${service.name}`);

  try {
    let fullResponse = "";
    for await (const chunk of service.chat(messages)) {
      fullResponse += chunk;
    }

    console.log(`[COMPLETE] Full response collected: ${fullResponse.substring(0, 100)}...`);

    return jsonResponse({
      success: true,
      response: fullResponse,
      service: service.name,
    });
  } catch (error: any) {
    console.error(`[COMPLETE] Error in service ${service.name}:`, error);
    return jsonResponse(
      {
        success: false,
        error: error?.message || String(error),
        service: service.name,
        hint: error?.message?.includes("Invalid API Key") || error?.message?.includes("API Key")
          ? "Check that your API key is correct in the .env file (GROQ_API_KEY, CEREBRAS_API_KEY or OPENROUTER_API_KEY)"
          : undefined,
      },
      500
    );
  }
}

// Main server
const server = Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Health check endpoint
    if (req.method === "GET" && url.pathname === "/") {
      return jsonResponse({
        status: "ok",
        message: "Bun AI API Load Balancer is running",
        activeServices: services.map(s => s.name),
        endpoints: {
          streaming: "POST /chat/stream",
          complete: "POST /chat/complete",
        },
      });
    }

    // Streaming chat endpoint
    if (req.method === "POST" && url.pathname === "/chat/stream") {
      try {
        const body = await req.json();
        const validation = validateChatRequest(body);

        if (!validation.valid) {
          return errorResponse(validation.error, 400);
        }

        return await createStreamingResponse(validation.messages, validation.targetService);
      } catch (error: any) {
        console.error("[STREAM] Request processing error:", error);
        return errorResponse(
          error?.message || "Invalid JSON body",
          error?.message?.includes("JSON") ? 400 : 500
        );
      }
    }

    // Complete (non-streaming) chat endpoint
    if (req.method === "POST" && url.pathname === "/chat/complete") {
      try {
        const body = await req.json();
        const validation = validateChatRequest(body);

        if (!validation.valid) {
          return errorResponse(validation.error, 400);
        }

        return await createCompleteResponse(validation.messages, validation.targetService);
      } catch (error: any) {
        console.error("[COMPLETE] Request processing error:", error);
        return errorResponse(
          error?.message || "Invalid JSON body",
          error?.message?.includes("JSON") ? 400 : 500
        );
      }
    }

    // 404 for unknown routes
    return errorResponse("Not found. Available endpoints: POST /chat/stream, POST /chat/complete", 404);
  },
});

console.log(`🚀 Bun AI API Load Balancer is running on port ${server.port}`);
console.log(`📡 Streaming endpoint: http://localhost:${server.port}/chat/stream`);
console.log(`📝 Complete endpoint: http://localhost:${server.port}/chat/complete`);