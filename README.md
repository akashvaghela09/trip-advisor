# Trip Advisor - multi-agent trip planner

A web app where a user describes a trip in plain language and a multi-agent
system plans it. An **orchestration layer** routes the request to three
specialised agents, chains them when they depend on each other
(**Destination → Itinerary → Budget**), and synthesises a single coherent
answer. Every step is streamed live and persisted as an audit trail.

## How it works

```
User message
   │
   ▼
Planner (LLM)      → extracts constraints + decides which agents run, in what order
   │
   ▼
Executor (code)    → runs the plan deterministically, passing context between agents
   ├─ Destination Agent   suggests places; justifies each; code filters hard region constraint
   ├─ Itinerary Agent     day-by-day plan; flags low-confidence days
   └─ Budget Agent        line-item estimate; code recomputes total vs budget; proposes cheaper plan if over
   │
   ▼
Synthesis          → deterministic assembly of facts + LLM-smoothed summary
   │
   ▼  (Server-Sent Events: one stream drives the UI, transparency, and the audit log)
Browser
```

The design principle: **the LLM decides *what* to do (planning); code controls
*how* it runs (execution) and enforces every hard constraint.** See
[`docs/decision-note.md`](docs/decision-note.md).

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4, state via Context + `useReducer`.
- **Backend:** Node.js + Express 5, SSE streaming, SQLite (`better-sqlite3`).
- **Shared:** an `@trip/shared` workspace package - zod schemas + types + the SSE event contract, the single source of truth for both sides.
- **LLM:** Google Gemini (free tier), behind a provider interface so it's swappable.

## Project structure

```
trip-advisor/
├── shared/    @trip/shared - zod schemas, types, SSE event contract
├── backend/   Express API, agents, orchestrator, SQLite audit store
│   └── src/
│       ├── llm/           provider interface + Gemini implementation
│       ├── db/            RunRepository interface + SQLite implementation
│       ├── agents/        destination, itinerary, budget (constraints enforced in code)
│       ├── orchestrator/  planner, executor, synthesis
│       └── routes/        POST /api/plan (SSE), GET /api/runs (history)
└── client/    React app: two-pane UI (event trace + agent timeline + answer)
```

## Running locally

Prerequisites: **Node 20+** and npm 10+.

```bash
# 1. Install (npm workspaces - installs all three packages)
npm install

# 2. Configure the backend (model key, CORS, etc.)
cp backend/.env.example backend/.env
#   then edit backend/.env and set GEMINI_API_KEY=...  (free key from https://aistudio.google.com/apikey)
#   the client has its own optional config: cp client/.env.example client/.env

# 3. Run everything (shared watch + backend + client)
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001 (the client dev server proxies `/api` to it)

Without a `GEMINI_API_KEY` the app still runs and demonstrates the error /
degradation path (agents fail gracefully and the run is still audited).

### Production build

```bash
npm run build      # builds shared, compiles backend (tsc), builds client (vite)
npm start          # runs the compiled backend (node backend/dist/index.js)
```

## Environment variables

| Var               | Where    | Purpose                                                  |
| ----------------- | -------- | -------------------------------------------------------- |
| `GEMINI_API_KEY`  | backend  | Google Gemini API key (server-side only)                 |
| `GEMINI_MODEL`    | backend  | Model id (default `gemini-2.0-flash`)                    |
| `PORT`            | backend  | API port (default 3001)                                  |
| `ALLOWED_ORIGINS` | backend  | Comma-separated frontend origins for CORS                |
| `DB_PATH`         | backend  | SQLite file path (default `./data/audit.db`)             |
| `LLM_TIMEOUT_MS`  | backend  | Per-call timeout (default 25000)                         |
| `LLM_MAX_RETRIES` | backend  | Retries per call (default 2)                             |
| `RUN_MAX_MS`      | backend  | Overall run cap (default 90000)                          |
| `VITE_API_URL`    | client   | Backend base URL in prod (empty in dev → Vite proxy)     |

## Deployment

The frontend and backend deploy independently (so CORS is real in prod):

- **Backend** → a DigitalOcean droplet behind nginx (TLS + `proxy_buffering off`
  for SSE). See [`deploy/nginx.conf.example`](deploy/nginx.conf.example). Run the
  compiled server under `pm2`/`systemd`. SQLite lives on the droplet's persistent disk.
- **Frontend** → Vercel (static build). Set `VITE_API_URL` to the backend URL,
  and add the Vercel URL to the backend's `ALLOWED_ORIGINS`.

See [`docs/architecture-azure.md`](docs/architecture-azure.md) for how this
would scale to 500+ concurrent users on Azure.

## Persistence / audit schema

- `runs` - one row per request: message, plan, final answer, status, duration.
- `agent_steps` - one row per agent invocation: input, output, status, error,
  duration, constraint flag. This is the audit trail of which agents handled
  each request. Accessed behind a `RunRepository` interface so SQLite → Postgres
  is a one-file swap.
