# Bitcoin Transcripts Backend

Node.js/Express backend API for the BitScribe platform. Acts as the single gateway between the React frontend and all external services — Supabase (PostgreSQL) for data and a pluggable AI provider (Amazon Bedrock + Polly, or Google Gemini) for summaries, chat, TTS, and entity extraction. The frontend never talks directly to Supabase or the AI provider.

## Features

- **RESTful API** — Clean, versioned endpoints (`/api/v1/`)
- **Supabase Integration** — PostgreSQL via Supabase client with lazy initialization and operation timeouts (10s default)
- **AI (Bedrock or Gemini)** — Summary generation, conversational chat, text-to-speech (PCM audio), and entity extraction, via the provider selected by `AI_PROVIDER`
- **Search** — Case-insensitive `ILIKE` search across title + raw_text + corrected_text, sanitized input, capped at 50 results
- **Rate Limiting** — Tiered protection (general: 100/min, AI: 20/min, TTS: 5/min)
- **Input Validation** — express-validator rules per endpoint (UUID params, query length 2–200, body constraints)
- **Security** — Helmet headers, CORS whitelist, SQL wildcard stripping, request timeout
- **Logging** — Winston structured logging with redacted credentials
- **Error Handling** — Centralized `APIError` class with HTTP codes and error codes

## Architecture

```
Frontend (React) ──▶ Backend (Express, port 5000) ──▶ Supabase (PostgreSQL)
                               │
                               └──▶ AI provider (Amazon Bedrock + Polly, or Google Gemini)
```

## Project Structure

```
backend/
├── src/
│   ├── app.js                  # Express app config (middleware, routes, error handling)
│   ├── server.js               # Server entry point (port binding)
│   ├── config/
│   │   ├── index.js            # Environment config loader
│   │   ├── aws.js              # Shared AWS SDK client options (credentials, region, timeouts)
│   │   └── logger.js           # Winston logger setup
│   ├── controllers/
│   │   ├── transcriptController.js  # Transcript CRUD + search handlers
│   │   ├── aiController.js          # AI endpoint handlers (summary, chat, TTS, entities)
│   │   ├── healthController.js      # Health check handlers
│   │   └── index.js                 # Barrel export
│   ├── middleware/
│   │   ├── errorHandler.js     # Global error handler + APIError class
│   │   ├── rateLimiter.js      # express-rate-limit middleware (tiered)
│   │   ├── validation.js       # express-validator rules + validate middleware
│   │   └── index.js            # Barrel export (includes asyncHandler)
│   ├── routes/
│   │   ├── transcriptRoutes.js # GET /transcripts, /conferences, /search, /:id
│   │   ├── aiRoutes.js         # POST /summary, /chat, /tts, /entities
│   │   ├── healthRoutes.js     # GET /health, /health/detailed
│   │   └── index.js            # Route aggregator
│   ├── services/
│   │   ├── supabaseService.js  # Supabase client init, CRUD, search, cache ops
│   │   ├── aiService.js        # Provider-neutral AI ops (summary, chat, TTS, entities)
│   │   ├── ai/
│   │   │   ├── bedrockProvider.js  # Bedrock Converse (text) + Polly (speech)
│   │   │   └── geminiProvider.js   # Gemini (text + speech)
│   │   └── index.js            # Barrel export
│   └── utils/
│       ├── dataProcessor.js    # transformToConferences() — groups transcripts by event
│       ├── responseHelper.js   # sendSuccess(), sendError() response formatters
│       └── index.js            # Barrel export
├── .env.example
├── package.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials (see below)
```

### Required Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
AI_PROVIDER=bedrock
AWS_REGION=us-east-1
```

### Running

```bash
# Development (with hot reload via nodemon)
npm run dev

# Production
NODE_ENV=production npm start
```

Server runs at `http://localhost:5000`.

## API Endpoints

### Transcripts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/transcripts` | Get all transcripts (ordered by date desc) |
| GET | `/api/v1/transcripts/conferences` | Get transcripts grouped by conference |
| GET | `/api/v1/transcripts/search?q=query` | Search transcripts (min 2, max 200 chars) |
| GET | `/api/v1/transcripts/:id` | Get transcript by UUID |

### AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/summary` | Generate transcript summary (body ≥ 100 chars) |
| POST | `/api/v1/ai/chat` | Chat with transcript context (message 1–2000 chars) |
| POST | `/api/v1/ai/tts` | Convert text to speech — returns PCM audio (text 1–5000 chars) |
| POST | `/api/v1/ai/entities` | Extract entities from transcript |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Basic health check |
| GET | `/api/v1/health/detailed` | Detailed service status (Supabase + AI provider connectivity) |

## Search — How It Works

The search pipeline has three layers of protection and processing:

### 1. Validation (middleware/validation.js)

```
express-validator checks:
  - q param is required, not empty
  - Length: 2–200 characters
  - Trimmed and HTML-escaped
```

### 2. Sanitization (services/supabaseService.js)

```
Before hitting the database:
  - Strip SQL wildcards: % _ \
  - Strip dangerous chars: < > " ' ` ; ( ) { } [ ]
  - Trim whitespace
  - Cap at 200 characters
  - Reject queries shorter than 2 chars after sanitization
```

### 3. Query Execution (Supabase/PostgreSQL)

```sql
SELECT * FROM transcripts
WHERE title ILIKE '%query%'
   OR raw_text ILIKE '%query%'
   OR corrected_text ILIKE '%query%'
ORDER BY event_date DESC
LIMIT 50;
```

- **ILIKE** = case-insensitive pattern matching (PostgreSQL)
- Searches across three text columns simultaneously using Supabase `.or()` filter
- Results capped at 50 and sorted newest-first
- Wrapped in a 10-second timeout to prevent hung queries

### 4. Response Transformation (controllers/transcriptController.js)

Raw transcript rows are grouped into conference objects via `transformToConferences()` before returning to the frontend, so the response shape matches the `/conferences` endpoint.

## Request/Response Examples

### Search

```bash
curl "http://localhost:5000/api/v1/transcripts/search?q=lightning"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "conf_bitcoin_plus_plus_2026",
      "name": "Bitcoin Plus Plus 2026",
      "talks": [
        {
          "id": "uuid-here",
          "title": "Lightning's (other) Toxic Waste Problem",
          "speakers": ["Peter Todd"],
          "date": "2026-01-15"
        }
      ]
    }
  ],
  "message": "Found 1 matching transcripts"
}
```

### Generate Summary

```bash
curl -X POST http://localhost:5000/api/v1/ai/summary \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Full transcript text...", "transcriptId": "uuid-optional"}'
```

```json
{
  "success": true,
  "data": {
    "summary": "**Key Points:**\n- Point 1\n- Point 2",
    "cached": false
  }
}
```

### Chat with Transcript

```bash
curl -X POST http://localhost:5000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What was discussed about Lightning Network?",
    "transcript": "Full transcript text...",
    "history": []
  }'
```

```json
{
  "success": true,
  "data": {
    "message": "The speaker discussed...",
    "role": "model",
    "timestamp": 1234567890
  }
}
```

## Rate Limits

| Endpoint Type | Requests | Window |
|---------------|----------|--------|
| General API | 100 | 1 minute |
| AI Endpoints | 20 | 1 minute |
| TTS Endpoint | 5 | 1 minute |

Exceeded limits return `429 Too Many Requests`.

## Input Validation Rules

| Endpoint | Field | Rules |
|----------|-------|-------|
| GET `/search` | `q` (query) | Required, 2–200 chars, trimmed, escaped |
| GET `/:id` | `id` (param) | Required, valid UUID |
| POST `/summary` | `transcript` | Required, min 100 chars |
| POST `/summary` | `transcriptId` | Optional, valid UUID |
| POST `/chat` | `message` | Required, 1–2000 chars, trimmed |
| POST `/chat` | `transcript` | Required, min 100 chars |
| POST `/chat` | `history` | Optional, must be array |
| POST `/tts` | `text` | Required, 1–5000 chars, trimmed |

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment (development / production) | No | development |
| `PORT` | Server port | No | 5000 |
| `SUPABASE_URL` | Supabase project URL | **Yes** | — |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | **Yes** | — |
| `AI_PROVIDER` | `bedrock`, `gemini` or `none` | No | `gemini` if `GEMINI_API_KEY` is usable, else `none` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS keys, used only when both are set; otherwise `AWS_PROFILE` or an IAM role | No | — |
| `AWS_SESSION_TOKEN` | Session token for temporary AWS credentials | No | — |
| `AWS_REGION` | Default AWS region (falls back to `AWS_DEFAULT_REGION`) | With `bedrock`, unless `BEDROCK_REGION` is set | — |
| `BEDROCK_REGION` | Region for Bedrock, where the model is available | No | `AWS_REGION` |
| `POLLY_REGION` | Region for Polly | No | `AWS_REGION` |
| `BEDROCK_MODEL_ID` | Bedrock model or inference profile ID (Converse API) | No | `amazon.nova-lite-v1:0` |
| `BEDROCK_MAX_TOKENS` | Output token cap per Bedrock call | No | 4096 |
| `POLLY_VOICE_ID` | Polly voice | No | Joanna |
| `POLLY_ENGINE` | Polly engine (`standard`, `neural`, `generative`) | No | neural |
| `GEMINI_API_KEY` | Google Gemini API key | With `gemini` | — |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | No | localhost:5173,3000 |
| `LOG_LEVEL` | Logging level | No | info |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | No | 60000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | No | 100 |

## Error Responses

All errors follow a standard shape:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Invalid input (bad params, too short, wrong type) |
| `NOT_FOUND` | 404 | Resource not found (invalid transcript ID) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in window |
| `DATABASE_ERROR` | 500 | Supabase operation failed or timed out |
| `AI_SERVICE_ERROR` | 500 | AI provider error |
| `AI_NOT_CONFIGURED` | 503 | No AI provider configured |

## Security Features

- **Helmet** — Sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS** — Configurable origin whitelist (defaults to localhost dev ports)
- **Rate Limiting** — Per-IP tiered limits via express-rate-limit
- **Input Validation** — express-validator sanitization on every endpoint
- **SQL Injection Protection** — Query parameterization via Supabase client + manual wildcard stripping
- **Request Timeout** — 10s database operation timeout (configurable)
- **No Credential Logging** — Sensitive data redacted from logs

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server (production) |
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |

## License

MIT
