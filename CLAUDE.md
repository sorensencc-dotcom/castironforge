# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent packages — no monorepo tooling, no shared build step:

- `chat-frontend/` — Vite + React 18 + TypeScript + Tailwind CSS. Dev server on `:5173`.
- `chat-agent/` — Express + TypeScript (ts-node-dev). API server on `:8000`.
- `docs/` — static documentation only (Jekyll CI targets `docs/migration-2026-05-04` branch).
- `archive/` — historical migration artifacts; do not modify.

## Commands

All commands must be run from inside the relevant package directory.

### chat-agent (backend)

```bash
cd chat-agent
npm install
npm run dev        # ts-node-dev with --respawn; watches src/
npm run build      # tsc → dist/
npm start          # node dist/server.js (requires build first)
./node_modules/.bin/tsc --noEmit   # type-check (use local tsc, not global)
```

### chat-frontend (frontend)

```bash
cd chat-frontend
npm install
npm run dev        # Vite dev server on :5173
npm run build      # Vite production build → dist/
./node_modules/.bin/tsc --noEmit   # type-check (use local tsc, not global)
```

> **Important:** Always use `./node_modules/.bin/tsc` for type-checking, not `npx tsc`. A global TypeScript installation will fail to resolve local `node_modules/` under `moduleResolution: bundler`.

## Architecture

### Request flow

```
Browser (chat-frontend :5173)
  └─ chatApi.ts (fetch / EventSource)
      └─ chat-agent :8000
          ├─ resolveRuntime(model prefix)  →  RuntimeAdapter
          │    local:*  → ollamaAdapter    (Ollama :11434)
          │    cpu:*    → llamaCppAdapter  (llama.cpp :8080)
          │    torque:* → torqueAdapter    (TorqueQuery :9000)
          └─ rag.search()                  →  TorqueQuery :9000/query
               └─ buildRagPrompt()
                    └─ runtime.complete() / runtime.stream()
```

### Backend key files

- `chat-agent/src/runtimes/types.ts` — `RuntimeAdapter` interface. Any new inference backend must implement `health`, `models`, `complete`, `stream`, `embed`.
- `chat-agent/src/runtimes/config.ts` — all external URLs via `getEnv(key, fallback)`. Override with `OLLAMA_URL`, `LLAMACPP_URL`, `TORQUE_URL` env vars.
- `chat-agent/src/router/chatAgentRouter.ts` — single Express router for all routes. `resolveRuntime()` maps model prefix to adapter; throws synchronously so callers catch before committing SSE headers.
- `chat-agent/src/rag/rag.ts` — TorqueQuery search. Non-fatal: callers use `.catch(() => [])` so chat works when TorqueQuery is down.

### Frontend key files

- `chat-frontend/src/types/chat.ts` — shared types for both frontend state and the API contract (`ChatMessage`, `ChatRequest`, `HealthStatus`, `Model`).
- `chat-frontend/src/hooks/useChatSession.ts` — single source of truth for session state (messages, model, sessionId, isStreaming). Instantiated once in `App.tsx`; passed as a prop to children. Do not call it in child components.
- `chat-frontend/src/hooks/useStreamingChat.ts` — owns the EventSource lifecycle. `closeRef` is cleaned up via `useEffect` on unmount.
- `chat-frontend/src/api/chatApi.ts` — all network calls. `BASE_URL` is hardcoded to `http://localhost:8000`.

### SSE streaming contract

`GET /chat/stream?sessionId=&model=&message=` emits `data: <token>\n\n` per token, terminates with `data: [DONE]\n\n` on success or `data: [ERROR]\n\n` on failure. The frontend accumulates tokens into a buffer in `useStreamingChat`; it does not reset to empty on each token.

### CORS

The backend only allows `Origin: http://localhost:5173`. Change `server.ts` if the frontend port changes. OPTIONS preflights return 204 with no body.

## Full Stack Startup

Running the complete CIC Chat Agent stack locally requires five services:

### 1. TorqueQuery (FastAPI RAG service)
```bash
cd ../torquequery
export PYTHONPATH=.
uvicorn torquequery.main:app --host 0.0.0.0 --port 9000 --reload
```

Or on Windows PowerShell:
```powershell
cd ../torquequery
$env:PYTHONPATH="."
uvicorn torquequery.main:app --host 0.0.0.0 --port 9000 --reload
```

This service runs on `:9000` by default (set via `TORQUE_URL` env var in `chat-agent/src/runtimes/config.ts`). It provides `/health` and `/query` endpoints for RAG search.

### 2. Ollama (Local LLM inference)
```bash
ollama serve
```

Listens on `:11434`. Pull models with `ollama pull qwen2.5`.

### 3. llama.cpp (Alternative inference)
```bash
./llama-server -m model.gguf -ngl 99 --port 8080
```

Listens on `:8080`. Optional if using Ollama.

### 4. Chat Agent Backend
```bash
cd chat-agent
npm install
npm run dev
```

Listens on `:8000`. Connects to all three services above and orchestrates requests.

### 5. Chat Frontend
```bash
cd chat-frontend
npm install
npm run dev
```

Vite dev server on `:5173`. Opens browser to `http://localhost:5173`.

### Quick reference (all terminals side-by-side)
| Service | Port | Command |
|---------|------|---------|
| TorqueQuery | 9000 | `cd torquequery && uvicorn torquequery.main:app --host 0.0.0.0 --port 9000 --reload` |
| Ollama | 11434 | `ollama serve` |
| llama.cpp | 8080 | `./llama-server -m model.gguf -ngl 99 --port 8080` |
| chat-agent | 8000 | `cd chat-agent && npm run dev` |
| chat-frontend | 5173 | `cd chat-frontend && npm run dev` |

Once all five are running, open `http://localhost:5173` and you can select between `local:*` (Ollama), `cpu:*` (llama.cpp), and `torque:*` (TorqueQuery) models.
