import { getNextService, services } from "./services";
import type { ChatMessage, EstimacionObraRequest, EstimacionObraResponse } from "./types";

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

// Parse the first JSON block out of an LLM response text
function extractJsonBlock(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start === -1 || end === 0) return {};
  try {
    return JSON.parse(text.slice(start, end)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Build the prompt messages for the estimacion-obra endpoint
function buildEstimacionMessages(req: EstimacionObraRequest): ChatMessage[] {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

  const desglose = Object.entries(req.estimacion_heuristica.desglose_por_rubro)
    .map(([rubro, monto]) => `  - ${rubro}: ${fmt(monto)}`)
    .join("\n");

  const systemPrompt = `Sos un experto en costos de construcción residencial en Argentina con más de 20 años de experiencia.
Tu tarea es analizar una estimación heurística de costos de obra y enriquecerla con tu criterio profesional.
Respondé ÚNICAMENTE con un bloque JSON válido, sin texto adicional antes ni después.
El JSON debe tener exactamente estos campos:
{
  "sugerencia_narrativa": "<string: análisis conciso en 2-3 oraciones, mencionando riesgos o consideraciones clave>",
  "ajuste_recomendado_pct": <number entre -30 y 30, o null si no aplica>,
  "alertas": [<array de strings, máx 3 alertas concretas, puede ser vacío>]
}`;

  const userMessage = `Analizá la siguiente estimación de obra:

Obra: "${req.nombre_obra}"
Superficie: ${req.superficie_m2} m²${req.provincia_id ? ` (provincia ID: ${req.provincia_id})` : ""}

Estimación heurística:
  Total estimado: ${fmt(req.estimacion_heuristica.total_estimado)}
  Margen de error: ±${req.estimacion_heuristica.margen_error_pct}%
  Desglose por rubro:
${desglose}

Generá tu análisis profesional en el formato JSON indicado.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
}

// Handle POST /estimacion-obra
async function handleEstimacionObra(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Request body must be a JSON object", 400);
  }

  const input = body as EstimacionObraRequest;
  if (!input.nombre_obra || typeof input.superficie_m2 !== "number" || !input.estimacion_heuristica) {
    return errorResponse("Missing required fields: nombre_obra, superficie_m2, estimacion_heuristica", 400);
  }

  const service = getNextService();
  console.log(`[ESTIMACION] Using service: ${service.name} for obra: ${input.nombre_obra}`);

  try {
    const messages = buildEstimacionMessages(input);
    let fullText = "";
    for await (const chunk of service.chat(messages)) {
      fullText += chunk;
    }

    console.log(`[ESTIMACION] Raw response: ${fullText.substring(0, 200)}`);

    const parsed = extractJsonBlock(fullText);

    const result: EstimacionObraResponse = {
      sugerencia_narrativa:
        typeof parsed.sugerencia_narrativa === "string"
          ? parsed.sugerencia_narrativa
          : fullText.trim().slice(0, 500),
      ajuste_recomendado_pct:
        typeof parsed.ajuste_recomendado_pct === "number" ? parsed.ajuste_recomendado_pct : null,
      alertas: Array.isArray(parsed.alertas)
        ? (parsed.alertas as unknown[]).filter((a): a is string => typeof a === "string")
        : [],
    };

    return jsonResponse(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[ESTIMACION] Error: ${msg}`);
    return jsonResponse(
      {
        sugerencia_narrativa: null,
        ajuste_recomendado_pct: null,
        alertas: ["El servicio de IA no está disponible en este momento."],
        error: msg,
      },
      503
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
          estimacionObra: "POST /estimacion-obra",
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

    // Estimacion obra endpoint
    if (req.method === "POST" && url.pathname === "/estimacion-obra") {
      return await handleEstimacionObra(req);
    }

    // 404 for unknown routes
    return errorResponse(
      "Not found. Available endpoints: POST /chat/stream, POST /chat/complete, POST /estimacion-obra",
      404
    );
  },
});

console.log(`🚀 Bun AI API Load Balancer is running on port ${server.port}`);
console.log(`📡 Streaming endpoint: http://localhost:${server.port}/chat/stream`);
console.log(`📝 Complete endpoint: http://localhost:${server.port}/chat/complete`);