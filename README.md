# Deep Research Engine

[![Stack](https://img.shields.io/badge/stack-React%20%C2%B7%20Express%20%C2%B7%20LangGraph-indigo)](#tech-stack)
[![Realtime](https://img.shields.io/badge/realtime-Socket.IO-blue)](#architecture)
[![Queue](https://img.shields.io/badge/jobs-BullMQ%20%2B%20Redis-red)](#deep-research-pipeline)
[![Vectors](https://img.shields.io/badge/vectors-Qdrant-teal)](#tech-stack)
[![Deploy](https://img.shields.io/badge/deploy-Docker%20Compose-2496ed)](#quickstart-docker-recommended)

An end-to-end research assistant. Ask a quick question and get an instant streaming
answer, or ask for a full investigation and get a cited, multi-section report —
researched by an 8-agent LangGraph pipeline, grounded in live web sources and your
own uploaded documents.

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Benefits](#benefits)
- [How it works](#how-it-works)
- [Deep research pipeline](#deep-research-pipeline)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Quickstart — Docker (recommended)](#quickstart--docker-recommended)
- [Local development (no Docker)](#local-development-no-docker)
- [Configuration](#configuration)
- [API & realtime reference](#api--realtime-reference)
- [npm scripts](#npm-scripts)
- [Testing](#testing)
- [Deployment notes](#deployment-notes)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Why this exists

Chatbots answer from frozen training data and rarely show their work. Deep Research
Engine closes that gap:

1. **Live knowledge** — every research run searches the current web (Tavily) and can
   pull live data (e.g. Open-Meteo for weather), so answers reflect 2026, not 2024.
2. **Cited output** — a dedicated citation agent maps claims to sources, so reports
   are verifiable instead of take-my-word-for-it.
3. **Your documents count** — upload PDFs/TXTs/CSVs; they are chunked, embedded
   locally, stored in Qdrant, and used as primary context for follow-up questions.
4. **Long jobs, honest UX** — research takes minutes. Jobs run in BullMQ workers
   (the HTTP layer never blocks), progress streams over Socket.IO, and a Stop
   button genuinely cancels — queued jobs are removed, in-flight output is
   suppressed and rolled back.

## Features

**Chat & research**

- Instant streaming chat (Gemini with Groq routing/fallback) with history per session
- Intent classification — quick questions answer immediately, research-grade
  questions are queued to the background pipeline automatically
- 8-agent deep research pipeline with reflection loop (re-searches until verified)
- Live research progress timeline in the UI (Planning → Searching → Reading →
  Embedding → Writing → Verifying) with elapsed timer
- Stop/cancel a run at any time — no phantom replies appear later
- Regenerate, copy, and per-report export menu (PDF, Markdown)

**Documents**

- Upload PDF / TXT / CSV, chunked and embedded with a local model
  (`Xenova/all-MiniLM-L6-v2`, 384-dim) — no embedding API costs
- Session-scoped retrieval: questions are answered from the document you attached
- Graceful degradation: chat and research still work if the vector DB is down

**Workspace**

- Sidebar with search, Today / Yesterday / 7-day / Older grouping, rename, delete
- Responsive layout with mobile drawer, collapsible desktop sidebar
- Split-panel auth screens, toasts, skeletons, keyboard shortcut (`/` focuses composer)

**Platform**

- JWT access + rotating refresh tokens (httpOnly cookie), Redis-backed rate limiting
- Single-origin production serving: one nginx on `:80` for SPA, REST, and WebSocket
- Prisma migrations run automatically on backend boot

## Benefits

| For | What you get |
| --- | ----------- |
| Users | One box for instant answers and deep reports, with sources attached |
| Researchers / analysts | Repeatable, cited market/topic reports in minutes, exportable to PDF |
| Teams with private docs | Ask questions over internal PDFs without pasting them into prompts |
| Developers | Clean agent graph, typed end-to-end, Docker Compose parity from laptop to server |

## How it works

```
                        ┌──────────────────────────────────────────────┐
                        │  nginx :80 (single origin)                   │
  browser ─────────────▶│  /            → React SPA (static)            │
                        │  /api/*       → backend:5000                 │
                        │  /socket.io/* → backend:5000 (websocket)     │
                        │  /health      → backend:5000                 │
                        └──────────────┬───────────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
     ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
     │ backend :5000  │─────▶│ Redis :6379    │      │ Qdrant :6333   │
     │ Express +      │      │ BullMQ queue   │      │ 384-dim vectors│
     │ Socket.IO +    │      │ rate-limit     │      │ research chunks│
     │ BullMQ worker  │      │ store          │      │ + doc chunks   │
     └───────┬────────┘      └────────────────┘      └────────────────┘
             │  Prisma
             ▼
     ┌────────────────┐     ┌─────────────────────────────────────────┐
     │ Postgres (Neon)│     │ External LLM/data APIs                  │
     │ users, sessions│     │ Gemini · Groq · Tavily · Open-Meteo     │
     │ messages       │     └─────────────────────────────────────────┘
     └────────────────┘
```

**Request flows**

- **Quick chat:** `chat:message` → intent=`chat` → history + doc excerpts + live
  context assembled → tokens streamed (`chat:chunk`) → saved → `chat:done`.
- **Deep research:** `chat:message` → intent=`research` → BullMQ job (worker,
  concurrency 1) → LangGraph pipeline → progress events → `chat:chunk` +
  `chat:done` with the final report, persisted as the assistant message.
- **Stop:** `chat:stop` → queued job removed if still waiting; otherwise output
  suppressed and the worker's saved message deleted — the UI shows “Stopped” and
  nothing resurfaces on reload.
- **Upload:** `POST /api/upload` (multer) → parse/chunk → local embeddings →
  Qdrant upsert with `sessionId` payload → system message confirms readiness.

## Deep research pipeline

Built with LangGraph (`backend/src/research/researchGraph.ts`):

| # | Agent | File | Job |
| - | ----- | ---- | --- |
| 1 | Planner | `planner.agent.ts` | Breaks the query into subtasks |
| 2 | Search | `search.agent.ts` | Tavily web search per subtask |
| 3 | Scraper | `scraper.agent.ts` | Fetches pages, extracts clean text chunks |
| 4 | Retrieval | `retrieval.agent.ts` | Embeds chunks locally, upserts to Qdrant, retrieves top-k context |
| 5 | Verification | `verification.agent.ts` | Cross-checks facts across sources |
| 6 | Reflection | `reflection.agent.ts` | Judges completeness — loops back to Search if gaps remain |
| 7 | Writer | `writer.agent.ts` | Drafts the structured report |
| 8 | Citation | `citation.agent.ts` | Maps claims to sources, finalizes the report |

Each agent emits a `research:progress` step that the frontend renders on its
timeline. If the local embedding model ever fails to load, retrieval degrades to
raw scraped context instead of failing the whole run.

## Tech stack

**Frontend** (`frontend/` — React 19, Vite 8, TypeScript)

| Layer | Choice |
| ----- | ------ |
| UI | React + Tailwind CSS v4 (`@theme` tokens), Inter |
| State | Redux Toolkit (auth, chat slices) |
| Routing | react-router-dom (login / register / chat + 404) |
| Realtime | socket.io-client (same-origin through nginx) |
| Markdown | react-markdown + remark-gfm, custom renderer (code copy, styled tables) |
| Icons | lucide-react |
| Export | html2pdf.js (lazy-loaded chunk, not in initial bundle) |

**Backend** (`backend/` — Node 22, TypeScript, Express 5)

| Layer | Choice |
| ----- | ------ |
| API | Express + Socket.IO, cookie + Bearer auth |
| Jobs | BullMQ worker (long lock, concurrency 1) on Redis |
| Agents | LangChain Core + LangGraph state graph |
| LLMs | Gemini (primary) with Groq routing/fallback |
| Search / live data | Tavily API, Open-Meteo (weather) |
| Embeddings | `@xenova/transformers` + onnxruntime (local, zero API cost) |
| Vectors | Qdrant (`research_chunks`, cosine, 384-dim) |
| ORM / DB | Prisma 5 → Postgres (Neon-hosted) |
| Uploads | multer → pdf-parse / txt / csv chunking |
| Rate limiting | express-rate-limit + Redis store |
| Image | Debian-slim Node (glibc required by onnxruntime) |

**Infrastructure**

| Piece | Choice |
| ----- | ------ |
| Reverse proxy + SPA host | nginx:alpine |
| Orchestration | Docker Compose (redis, qdrant, backend, nginx) |
| E2E | Playwright (`playwright_e2e/`, git-ignored local setup) |

## Repository structure

```
deep-research-engine/
├── docker-compose.yml          # redis, qdrant, backend, nginx (only :80 published)
├── nginx/
│   ├── Dockerfile              # builds React SPA, serves it, proxies /api /socket.io /health
│   └── nginx.conf              # upstream backend:5000, 24h socket timeouts, gzip, SPA fallback
├── backend/
│   ├── Dockerfile              # Debian-slim build+runtime (glibc for onnxruntime + openssl for Prisma)
│   ├── docker-entrypoint.sh    # prisma migrate deploy, then node dist/server.js
│   ├── prisma/
│   │   ├── schema.prisma       # User, ChatSession, Message
│   │   └── migrations/
│   └── src/
│       ├── server.ts           # Express + Socket.IO, CORS_ORIGIN env, /health, route mounts
│       ├── routes/             # auth, chat, session (CRUD), upload
│       ├── controllers/        # request handlers (incl. upload → embed → Qdrant)
│       ├── sockets/chat.socket.ts  # chat:message flow, research:cancel/stop, event bridge
│       ├── queues/researchQueue.ts # BullMQ queue + worker invoking the pipeline
│       ├── research/
│       │   ├── researchGraph.ts    # LangGraph wiring (see pipeline table)
│       │   ├── agents/             # planner…citation (8 agents)
│       │   └── types.ts
│       ├── middleware/         # auth, rate limiter, error handler
│       └── utils/              # jwt, llmRouter, vectorStore, tavily, weather, …
├── frontend/
│   ├── src/
│   │   ├── pages/              # LoginPage, RegisterPage, ChatPage
│   │   ├── components/         # Sidebar, ChatMessage, Composer, EmptyState,
│   │   │                       # ProgressStepper, MarkdownRenderer, Toasts, …
│   │   ├── features/           # auth + chat slices and API wrappers
│   │   ├── lib/                # axios (env base URL + refresh), socket, exportReport
│   │   └── app/store.ts        # Redux store
│   └── index.html              # title, Inter font, theme color
└── playwright_e2e/             # local-only Playwright smoke tests (git-ignored)
```

## Quickstart — Docker (recommended)

Single entrypoint: nginx on `http://localhost` serves the frontend and
reverse-proxies `/api/*`, `/socket.io/*`, `/health` to the backend.
Redis + Qdrant run as containers; Postgres is external (Neon).

**Prerequisites:** Docker + Docker Compose plugin, and a `backend/.env` file
(see [Configuration](#configuration)).

```bash
# from the repo root
docker compose up -d --build
docker compose logs -f backend   # watch migrations + worker boot
curl http://localhost/health     # {"status":"ok","userCount":...}
```

Open `http://localhost`, register, and ask something — e.g.
*“Write a comprehensive market report on AI in 2024.”*

```bash
docker compose ps                # all four services Up
docker compose down              # stop (add -v to also wipe redis/qdrant data)
```

Rebuild only what changed (faster on slow networks):

```bash
docker compose up -d --build backend   # backend/src, Dockerfile, entrypoint changes
docker compose up -d --build nginx     # frontend/ or nginx/ changes
```

## Local development (no Docker)

You need Redis on `:6379` and Qdrant on `:6333` (or point the URLs at containers).

```bash
# terminal 1 — backend on http://localhost:5000
cd backend
npm install
npx prisma migrate dev     # first run only (or against your Neon DB)
npm run dev

# terminal 2 — frontend on http://localhost:5173
cd frontend
npm install
npm run dev
```

`frontend/.env.development` already points Vite at `http://localhost:5000` for
both REST and Socket.IO; production builds default to same-origin `/api`.

## Configuration

Create `backend/.env` (never committed — gitignored):

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `DATABASE_URL` | Yes | Postgres connection string (Neon) |
| `JWT_SECRET` | Yes | Signs short-lived access tokens |
| `JWT_REFRESH_SECRET` | Yes | Signs rotating refresh-token cookie |
| `GEMINI_API_KEY` | Yes | Primary LLM (chat, agents) |
| `GROQ_API_KEY` | Yes | LLM routing/fallback |
| `TAVILY_API_KEY` | Yes | Web search for research + live answers |
| `PORT` | No | Backend port (Compose sets `5000`) |
| `REDIS_URL` | No | Compose sets `redis://redis:6379` |
| `QDRANT_URL` | No | Compose sets `http://qdrant:6333` |
| `CORS_ORIGIN` | No | Compose sets `http://localhost` (CSV for multiple) |

Frontend build args (baked at image build time, defaults suit Compose):

| Variable | Default (dev) | Docker build |
| -------- | ------------- | ------------ |
| `VITE_API_URL` | `http://localhost:5000/api` | `/api` |
| `VITE_SOCKET_URL` | `http://localhost:5000` | unset (same-origin) |

## API & realtime reference

Base URL is `/api` (same-origin in Docker, `:5000/api` in local dev). Auth: Bearer
access token + httpOnly refresh cookie; refresh is transparent via the axios
interceptor.

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/auth/register` | No | Create account → `{ user, accessToken }` |
| POST | `/auth/login` | No | Login → `{ user, accessToken }` |
| POST | `/auth/refresh` | Cookie | Rotate tokens |
| POST | `/auth/logout` | Yes | Clear refresh cookie |
| GET | `/me` | Yes | Current user |
| POST | `/chat` | Yes | One-shot REST chat (fallback path) |
| GET | `/sessions` | Yes | List sessions (id, title, timestamps) |
| GET | `/sessions/:id` | Yes | Session + messages |
| PATCH | `/sessions/:id` | Yes | Rename (`{ title }`) |
| DELETE | `/sessions/:id` | Yes | Delete session + messages |
| POST | `/upload` | Yes | Multipart `document` (+ optional `sessionId`) → chunk + embed + index |
| GET | `/health` | No | `{"status":"ok","userCount":n}` (DB-backed) |

**Socket.IO** (auth via `auth.token`):

| Direction | Event | Payload |
| --------- | ----- | ------- |
| Client → | `chat:message` | `{ message, sessionId \| null }` |
| Client → | `chat:stop` | `{}` — cancel the in-flight run |
| Server → | `chat:session` | `{ sessionId }` (new chats) |
| Server → | `chat:chunk` | `{ chunk }` (streaming tokens / full report) |
| Server → | `research:progress` | `{ step }` (agent timeline) |
| Server → | `chat:done` | `{ fullResponse }` |
| Server → | `chat:stopped` | `{}` (ack + late-event suppression) |
| Server → | `chat:error` | `{ error }` |

## npm scripts

```bash
# backend
cd backend
npm run dev            # ts-node-dev with respawn
npm run build          # tsc → dist/
npm start              # node dist/server.js (what Docker runs)
npm run prisma:migrate # prisma migrate dev
npm run prisma:studio  # visual DB browser

# frontend
cd frontend
npm run dev            # Vite HMR on :5173
npm run build          # tsc -b && vite build
npm run lint           # eslint
npm run preview        # serve the production build locally
```

## Testing

- **E2E (Playwright):** `playwright_e2e/` holds the smoke spec and config. It is
  intentionally local-only (git-ignored) — install and run it where you keep test
  credentials, not in CI by default.
- **Manual acceptance pass:** register → suggestion-card prompt → watch the
  progress stepper → report renders with citations → export PDF → upload a PDF →
  ask about it → rename/delete a chat → logout. At 390px width, the drawer and
  composer should stay fully usable.
- **Health gates after any infra change:** `curl http://localhost/health` and
  `docker compose ps` (all four `Up`).

## Deployment notes

- Only nginx publishes a host port (`80:80`), so host Redis/Qdrant for local dev
  never clash with Compose services.
- Backend is stateless except Postgres/Redis/Qdrant: scale it horizontally, but
  keep BullMQ `concurrency: 1` per replica unless jobs are partitioned.
- The embedding model downloads on first use (~90MB) — expect the first Retrieval
  step to take 1–2 minutes, then it is cached.
- Moving off port 80: change the `ports` mapping **and** `CORS_ORIGIN` together
  (e.g. `"8080:80"` + `http://localhost:8080`), then `up -d`.
- The single backend instance keeps in-memory cancel/run maps — fine as deployed;
  revisit with Redis-backed state if you scale the backend.

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `address already in use` on `:80` | Host nginx/Apache holds port 80 | `sudo systemctl stop nginx` (or remap to `8080:80` + matching `CORS_ORIGIN`) |
| `host not found in upstream "backend"` + nginx restart loop | Stale nginx container never joined the Compose network | `docker compose up -d --force-recreate nginx` |
| `Error loading shared library ld-linux-x86-64.so.2` | Alpine/musl image with onnxruntime | Use the provided Debian-slim `backend/Dockerfile` (already fixed) |
| Research job fails, scrape warnings | Some sites block scraping | Normal — failed URLs are skipped, the rest of the pipeline continues |
| Slow first `up --build` | `npm ci` ×2 + model-agnostic layers on slow net | Retry (layer cache resumes); never use `--no-cache` on slow links |
| Login loops / 401s | Missing/expired secrets in `backend/.env` | Fill all six required vars, `up -d` again |

## Roadmap

- Streaming token output for research drafts (currently one `chunk` + `done`)
- Per-user Qdrant namespaces and multi-document comparison views
- Scheduled / recurring research with email or webhook delivery
- SSO (Google/GitHub) alongside email auth
- Admin observability: job durations, token spend, agent-level traces

## Contributing

1. Fork and branch from `main` (`feat/…`, `fix/…`, `chore/…` — see git log style).
2. Match the existing patterns: typed agents, user-scoped Prisma queries, env-based
   URLs (no hardcoded hosts), Tailwind tokens over ad-hoc colors.
3. Verify: backend `npx tsc --noEmit`, frontend `npm run build`, Compose
   `up -d --build` + `/health`, and the manual acceptance pass above.
4. Keep secrets out of git — `backend/.env` is ignored; double-check diffs.

## License

ISC — see `backend/package.json`. If you publish or distribute this project,
consider adding a top-level `LICENSE` file.
