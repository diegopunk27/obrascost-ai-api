# ObrasCost — API Multiagente

Load balancer de proveedores LLM y endpoint de estimación inteligente para **ObrasCost**. Construido con Bun + TypeScript.

## Stack

| Concern | Tecnología |
|---|---|
| Runtime | Bun |
| Lenguaje | TypeScript |
| Proveedores LLM | Groq, Cerebras, OpenRouter |
| Estrategia | Round-robin con fallback |
| Tests | bun:test |

## Arquitectura

```
Cliente (BE ObrasCost)
        ↓
Load Balancer (Round Robin / Target específico)
        ↓
┌──────────────┬───────────────┬────────────────┐
│     Groq     │   Cerebras    │   OpenRouter   │
└──────────────┴───────────────┴────────────────┘
```

## Inicio rápido

```bash
bun install
cp .env.example .env
# Agregar al menos una API key en .env
bun run dev    # http://localhost:8080
```

## API Endpoints

### Health

```
GET /
```

Devuelve estado y proveedores activos en el pool.

### Chat completo

```
POST /chat/complete
```

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "targetService": "groq"
}
```

### Chat streaming

```
POST /chat/stream
```

Igual que `/chat/complete` pero responde con SSE en tiempo real.

### Estimación de obra (ObrasCost)

```
POST /estimacion-obra
```

Recibe la metadata de la obra y la estimación heurística previa. Retorna análisis LLM.

**Request:**
```json
{
  "obra": {
    "nombre": "Casa Martínez",
    "superficie_m2": 150,
    "provincia": "Buenos Aires"
  },
  "estimacion_heuristica": {
    "total_estimado": 3000000,
    "desglose_por_rubro": { "Estructura": 2000000, "Pintura": 500000 },
    "margen_error_pct": 15
  }
}
```

**Response:**
```json
{
  "sugerencia_ia": "Considerar aumento en terminaciones dado el costo del m² en la zona.",
  "ajuste_recomendado_pct": 5,
  "alertas": ["Costo elevado para la región"]
}
```

> Este endpoint es consumido exclusivamente por el backend de ObrasCost, no por el frontend directamente.

## Testing

```bash
bun test src/
```

Tests unitarios del módulo `src/utils.ts` (extracción de JSON de respuestas LLM):

| Test | Descripción |
|---|---|
| JSON válido embebido | Extrae correctamente el bloque JSON |
| Texto vacío | Retorna `{}` |
| Sin JSON | Retorna `{}` |
| Texto antes/después | Extrae solo el bloque JSON |
| JSON inválido | Retorna `{}` con fallback graceful |
| Arrays en el texto | Ignora arrays, busca objeto `{}` |

## CI/CD (GitHub Actions)

Workflow: [`.github/workflows/bun-ci.yml`](.github/workflows/bun-ci.yml)

| Step | Qué hace |
|---|---|
| Setup Bun | `oven-sh/setup-bun@v2` |
| Install | `bun install` |
| Typecheck | `bun build src/index.ts --target bun --no-bundle` |
| Test | `bun test src/` |

**Triggers:** push y PR a `main` / `development`.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default: 8080) |
| `GROQ_API_KEY` | API key de Groq |
| `CEREBRAS_API_KEY` | API key de Cerebras |
| `OPENROUTER_API_KEY` | API key de OpenRouter |
| `GROQ_MODEL` | Modelo Groq (default: `llama-3.3-70b-versatile`) |
| `CEREBRAS_MODEL` | Modelo Cerebras (default: `llama3.1-8b`) |
| `OPENROUTER_MODEL` | Modelo OpenRouter (default: `nvidia/nemotron-3-super-120b-a12b:free`) |

## Estructura del proyecto

```
src/
  index.ts          Servidor principal + routing
  types.ts          Tipos TypeScript
  utils.ts          extractJsonBlock() — parsing de respuestas LLM
  utils.test.ts     Tests unitarios
  services/
    index.ts        Load balancer + registry
    groq.ts         Adaptador Groq
    cerebras.ts     Adaptador Cerebras
    openrouter.ts   Adaptador OpenRouter
```
