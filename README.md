# Deep Research Engine

## Run with Docker (recommended)

Single entrypoint: nginx on http://localhost serves the frontend and
reverse-proxies `/api/*`, `/socket.io/*`, `/health` to the backend.
Redis + Qdrant run as containers; Postgres is external (Neon).

```bash
# needs backend/.env with DATABASE_URL, JWT_*, GEMINI_*, GROQ_*, TAVILY_*
docker compose up -d --build
docker compose logs -f backend   # watch migrations + worker boot
curl http://localhost/health     # {"status":"ok",...}
docker compose down
```

## Local dev (no Docker)

```bash
# terminal 1 — needs redis on :6379, qdrant on :6333
cd backend && npm run dev
# terminal 2
cd frontend && npm run dev        # http://localhost:5173
```
