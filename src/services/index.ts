import { groqService } from "./groq";
import { cerebrasService } from "./cerebras";
import { openrouterService } from "./openrouter";
import type { AIService } from "../types";

// Only register services whose API keys are present
const services: AIService[] = [
  ...(process.env.GROQ_API_KEY ? [groqService] : []),
  ...(process.env.CEREBRAS_API_KEY ? [cerebrasService] : []),
  ...(process.env.OPENROUTER_API_KEY ? [openrouterService] : []),
];

if (services.length === 0) {
  console.error("❌ No AI services configured. Set at least one API key in your .env file.");
  process.exit(1);
}

console.log(`✅ Active services (${services.length}): ${services.map(s => s.name).join(", ")}`);

let currentServiceIndex = 0;

export function getNextService(targetName?: string): AIService {
  if (targetName) {
    const found = services.find(s => s.name.toLowerCase().includes(targetName.toLowerCase()));
    if (found) {
      console.log(`🎯 Service overridden to specifically request: ${found.name}`);
      return found;
    }
    console.warn(`⚠️  Requested target service "${targetName}" not found. Falling back to round-robin.`);
  }

  const service = services[currentServiceIndex];
  // Round Robin: Incrementa y vuelve a 0 si llega al final
  currentServiceIndex = (currentServiceIndex + 1) % services.length;
  return service;
}

export { services };