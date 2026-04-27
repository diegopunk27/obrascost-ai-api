# Bun AI API Load Balancer

A high-performance AI API load balancer built with Bun that distributes requests across multiple AI service providers (Groq, Cerebras, and OpenRouter) using a round-robin strategy.

## Features

- **Load Balancing**: Round-robin distribution across multiple AI services.
- **Dynamic Configuration**: Configure models and API keys for each service via `.env`.
- **Targeted Requests**: Force a specific service using the `targetService` parameter.
- **Conditional Registration**: Services are only added to the rotation if their API key is present.
- **Dual Response Modes**:
  - Streaming responses for real-time chat.
  - Complete responses for batch processing.
- **Comprehensive Testing Suite**: Built-in scripts to test infrastructure and specific services.
- **Built with Bun**: Ultra-fast JavaScript runtime with native TypeScript support.
- **Docker Support**: Production-ready containerization.

## Architecture

```
Client Request
     ↓
Load Balancer (Round Robin / Specific Target)
     ↓
┌──────────────┬───────────────┬────────────────┐
│     Groq     │   Cerebras    │   OpenRouter   │
└──────────────┴───────────────┴────────────────┘
```

## Prerequisites

- [Bun](https://bun.sh) v1.0 or later (for local development)
- Docker & Docker Compose (for containerized deployment)
- API Keys for at least one service:
  - Groq API Key
  - Cerebras API Key
  - OpenRouter API Key

## Installation

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd api-multiagente
```

2. Install dependencies:
```bash
bun install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Add your API keys and (optional) model preferences to `.env`:
```env
GROQ_API_KEY=gsk_...
CEREBRAS_API_KEY=csk-...
OPENROUTER_API_KEY=sk-or-v1-...

# Optional: Default models are used if not specified
GROQ_MODEL=llama-3.3-70b-versatile
CEREBRAS_MODEL=llama3.1-8b
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

5. Run the development server:
```bash
bun run dev
```

## API Endpoints

### Health Check

**GET** `/`

Returns the API status, available endpoints, and currently active services in the pool.

**Response:**
```json
{
  "status": "ok",
  "message": "Bun AI API Load Balancer is running",
  "activeServices": [
    "Groq (llama-3.3-70b-versatile)",
    "Cerebras (llama3.1-8b)",
    "OpenRouter (nvidia/nemotron-3-super-120b-a12b:free)"
  ],
  "endpoints": {
    "streaming": "POST /chat/stream",
    "complete": "POST /chat/complete"
  }
}
```

### Complete Chat

**POST** `/chat/complete`

Waits for the full AI response before returning.

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "What is 2+2?"}
  ],
  "targetService": "groq" 
}
```
*`targetService` is optional. Use it to force a specific provider (case-insensitive search in service name).*

**Success Response (200):**
```json
{
  "success": true,
  "response": "2 + 2 is 4.",
  "service": "Groq (llama-3.3-70b-versatile)"
}
```

### Streaming Chat

**POST** `/chat/stream`

Streams AI responses in real-time. Supports the same `targetService` parameter.

**Example with curl:**
```bash
curl -X POST http://localhost:8080/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Count to 5"}],
    "targetService": "cerebras"
  }'
```

## Development & Testing

### Test Suite

The project includes a comprehensive test script `test-api.sh` that validates infrastructure, error handling, and service rotation.

Run all tests:
```bash
yarn test
```

Test a specific service:
```bash
yarn test:groq
yarn test:cerebras
yarn test:openrouter
```

### Project Structure

```
api-multiagente/
├── src/
│   ├── index.ts              # Main server & routing
│   ├── types.ts              # Type definitions
│   └── services/
│       ├── index.ts          # Load balancer & Registry
│       ├── groq.ts           # Groq adapter
│       ├── cerebras.ts       # Cerebras adapter
│       └── openrouter.ts     # OpenRouter adapter
├── test-api.sh               # Advanced Bash test suite
├── Dockerfile                # Production Docker build
├── .env.example              # Environment template
└── package.json              # Scripts & dependencies
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 8080) |
| `GROQ_API_KEY` | Groq API Key |
| `CEREBRAS_API_KEY`| Cerebras API Key |
| `OPENROUTER_API_KEY`| OpenRouter API Key |
| `GROQ_MODEL` | (Optional) Groq model ID |
| `CEREBRAS_MODEL` | (Optional) Cerebras model ID |
| `OPENROUTER_MODEL`| (Optional) OpenRouter model ID |

## License

MIT
