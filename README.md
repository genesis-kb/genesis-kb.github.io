# BitScribe

A specialized transcription and AI summarization dashboard for Bitcoin conferences. Features real-time AI analysis, interactive chat-with-transcript, AI-powered audio generation, and a dedicated transcript reader — all powered by a Node.js/Express backend with Supabase and Google Gemini AI.

## Architecture

```
┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────┐
│   Frontend          │──────▶│    Backend           │──────▶│   Supabase      │
│   React 18 + Vite   │       │   Node.js / Express  │       │   (PostgreSQL)  │
│   Port: 5173        │       │   Port: 5000         │       │                 │
└─────────────────────┘       └──────────┬───────────┘       └─────────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │   Google Gemini AI   │
                              │   (Summary / Chat /  │
                              │    TTS / Entities)   │
                              └─────────────────────┘
```

## Features

- **Conference Archive** — Browse conferences with grouped talks, expandable session lists
- **Transcript Detail** — 4-tab view: Summary, Transcript, Chat, Audio
- **Transcript Reader** — Dedicated tab with paragraph grouping, line-number gutter, alternating rows, and show-more pagination
- **AI Summary** — Auto-generated or on-demand summaries via Gemini (with caching)
- **Chat with Transcript** — Conversational Q&A grounded in transcript context
- **Audio Generation** — Text-to-speech playback with player controls (play/pause, skip, progress bar)
- **Global Search** — Keyboard-triggered (Ctrl+K / ⌘K) overlay with debounced backend search, grouped results by conference
- **Dark / Light Theme** — Toggle with system preference detection
- **Dynamic Stats** — Live ticker tape and homepage stats fetched from the API
- **Responsive Design** — Mobile-first layout with collapsible sidebar and adaptive UI

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS + tailwindcss-animate |
| UI Components | Radix UI primitives + shadcn/ui |
| Animations | Framer Motion |
| Markdown | react-markdown v10 |
| Routing | React Router DOM v6 |
| State | React Query (@tanstack/react-query) |
| Icons | Lucide React |
| Toasts | Sonner |
| Testing | Vitest + Testing Library |

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [Google Gemini API Key](https://aistudio.google.com/)
- A [Supabase](https://supabase.com/) project for persistent storage

## Quick Start

### 1. Install Dependencies

```bash
# Frontend
npm install

# Backend
cd backend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

### 3. Start Both Servers

```bash
# Terminal 1 — Backend (port 5000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
bitcoin_transcripts_frontend/
├── src/
│   ├── components/
│   │   ├── Layout.tsx              # App shell, navbar, search overlay, ticker
│   │   ├── CategorySidebar.tsx     # Sidebar navigation
│   │   ├── FeaturedTranscripts.tsx  # Homepage featured cards
│   │   ├── MarkdownRenderer.tsx    # Reusable markdown renderer
│   │   ├── TranscriptCard.tsx      # Transcript preview card
│   │   ├── TranscriptChat.tsx      # Chat-with-transcript component
│   │   ├── TranscriptAudio.tsx     # Audio generation & player
│   │   ├── ThemeToggle.tsx         # Dark/light mode toggle
│   │   └── ui/                     # shadcn/ui primitives
│   ├── pages/
│   │   ├── Index.tsx               # Homepage with stats & featured
│   │   ├── ConferenceArchive.tsx   # Conference list with talks
│   │   ├── TranscriptDetail.tsx    # Transcript detail (4 tabs)
│   │   ├── AudioGeneration.tsx     # Standalone audio generation
│   │   ├── Categories.tsx          # Category browser
│   │   ├── Topics.tsx              # Topic browser
│   │   ├── Speakers.tsx            # Speaker browser
│   │   ├── Types.tsx               # Type browser
│   │   ├── Sources.tsx             # Source browser
│   │   ├── About.tsx               # About page
│   │   └── NotFound.tsx            # 404 page
│   ├── hooks/                      # Custom hooks (theme, toast, mobile)
│   ├── lib/
│   │   └── utils.ts                # cn(), formatDate() helpers
│   └── main.tsx                    # Entry point
├── services/
│   ├── api.ts                      # HTTP client (Axios)
│   ├── config.ts                   # API base URL configuration
│   ├── dataService.ts              # Transcript & conference data ops
│   └── geminiService.ts            # AI operations (via backend proxy)
├── types.ts                        # TypeScript interfaces (RawTranscript, etc.)
├── backend/                        # Express.js backend (see backend/README.md)
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Frontend Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | Index | Homepage with dynamic stats and featured transcripts |
| `/conferences` | ConferenceArchive | Browse all conferences with expandable talk lists |
| `/transcript/:id` | TranscriptDetail | Full transcript view with Summary, Transcript, Chat, Audio tabs |
| `/categories` | Categories | Browse by category |
| `/topics` | Topics | Browse by topic |
| `/speakers` | Speakers | Browse by speaker |
| `/types` | Types | Browse by type |
| `/sources` | Sources | Browse by source |
| `/about` | About | About the project |
| `*` | NotFound | 404 page |

## API Endpoints

All API requests are proxied through the backend at `http://localhost:5000/api/v1/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/transcripts` | Get all transcripts |
| GET | `/transcripts/conferences` | Get conferences with grouped talks |
| GET | `/transcripts/search?q=` | Search transcripts (min 2 chars) |
| GET | `/transcripts/:id` | Get a single transcript by UUID |
| POST | `/ai/summary` | Generate AI summary |
| POST | `/ai/chat` | Chat with transcript context |
| POST | `/ai/tts` | Text-to-speech audio generation |
| POST | `/ai/entities` | Extract entities from transcript |
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed service status |

## Search Implementation

The search feature uses a client → backend → Supabase pipeline:

1. **Frontend** (Layout.tsx): Keyboard shortcut opens overlay → debounced input (300ms, min 2 chars) → calls `searchTranscripts()` via `dataService.ts`
2. **Backend** (supabaseService.js): Sanitizes query (strips SQL wildcards, dangerous chars, caps at 200 chars) → runs case-insensitive `ILIKE` search across `title`, `raw_text`, and `corrected_text` columns → returns up to 50 results ordered by date
3. **Frontend**: Groups results by conference and renders clickable cards that navigate to `/transcript/:id`

## Database Setup (Supabase)

Create a `transcripts` table in your Supabase project:

```sql
CREATE TABLE transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  speakers TEXT,
  event_date DATE,
  loc TEXT,
  raw_text TEXT,
  corrected_text TEXT,
  summary TEXT,
  tags TEXT[],
  categories TEXT[],
  media_url TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Enable read access for all users"
  ON transcripts FOR SELECT USING (true);
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |
| `npm run test:watch` | Run Vitest in watch mode |

## Build for Production

```bash
# Build frontend
npm run build

# Run backend in production mode
cd backend && NODE_ENV=production npm start
```

The frontend build outputs to `dist/` — serve with any static file server or deploy to Vercel/Netlify/Cloudflare Pages.

## Troubleshooting

**"No conferences found" or empty data:**
1. Ensure backend is running on port 5000
2. Check backend logs for Supabase connection errors
3. Verify the RLS policy exists (see Database Setup above)

**AI features not working:**
1. Verify `GEMINI_API_KEY` is set in `backend/.env`
2. Check backend logs for rate limit or API key errors

**CORS errors:**
1. Ensure frontend URL is listed in `CORS_ORIGINS` in `backend/.env`
2. Default allows `localhost:5173` and `localhost:3000`

**Hooks error ("Rendered more hooks than during the previous render"):**
1. All `useMemo`/`useEffect` calls must appear before any early `return` in React components
2. Check `TranscriptDetail.tsx` — hooks must not be placed after loading/error guard returns

Contributors can join our [discord](https://discord.gg/BxqCaQHFGz) server here

## License

MIT
