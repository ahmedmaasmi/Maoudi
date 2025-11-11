<!-- 3b0d61db-faba-4aa7-972a-d7532535c0b0 4c0eb116-469b-49b0-93db-414bbdfef877 -->
# Voice Appointment MVP — Monorepo + MCP (Free Stack)

### 1) Monorepo Layout (single folder, web+api+mobile+mcp)

Use pnpm workspaces + Turborepo for fast, free dev across apps.

- Root
                - `package.json` (workspaces + scripts)
                - `pnpm-workspace.yaml`
                - `turbo.json`
                - `.env` (root-only shared values) + per-app `.env.local`
- Apps
                - `apps/web/` Next.js 14 + Tailwind (voice/text UI)
                - `apps/api/` Express + TypeScript + Prisma/SQLite (business logic + Google Calendar)
                - `apps/mcp/` MCP server (tools: search_doctors, check_availability, book_appointment, geocode, parse_message)
                - `apps/mobile/` Expo React Native (placeholder now; shares APIs and types)
- Shared
                - `packages/shared/` shared types (Doctor, Appointment, NLU entities), zod schemas
                - `prisma/` schema + migrations

Minimal workspace files:

```json
// package.json (root)
{
  "private": true,
  "packageManager": "pnpm@9",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "prisma:migrate": "pnpm --filter @mcp/api prisma migrate dev"
  }
}
```
```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```
```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "lint": {}
  }
}
```

### 2) Backend (`apps/api/`) — Express + Prisma + Google Calendar

- Endpoints (unchanged from earlier plan):
                - `GET /auth/google/initiate`, `GET /auth/google/callback` (per-doctor OAuth)
                - `GET /doctors/search` (nearest by specialty)
                - `POST /availability` (free slots via Calendar freebusy)
                - `POST /appointments/book` (create GCal event + persist)
                - `GET /geocode` (proxy to Nominatim) — rate-limited
                - `POST /nlu/parse` (rule-based; optional Ollama refinement)
- Data: Prisma + SQLite; models from earlier plan
- Security: CORS allow-list for web, mobile dev, MCP; zod validation; basic rate limiting

Env (api): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_REDIRECT_URI`, `DATABASE_URL`, `BACKEND_API_KEY` (for MCP/mobile) and optional `OLLAMA_BASE_URL`.

### 3) Web (`apps/web/`) — Next.js + Tailwind + Web Speech API

- Chat-like flow with STT/TTS; progressive collection of specialty → location → date → slot → confirmation
- Calls API endpoints; uses `packages/shared` types

### 4) MCP Server (`apps/mcp/`) — Model Context Protocol

Goal: expose backend capabilities as MCP tools so any MCP-capable client/agent can drive booking.

- SDK: `@modelcontextprotocol/sdk` (Node, free)
- Connection: stdio or HTTP server; simplest is stdio when run by the client, or HTTP on localhost `:5005`
- Auth to API: include `x-api-key` header to call `apps/api`
- Tools (example signatures):
                - `search_doctors(specialty: string, near: { lat: number, lng: number }, radiusKm?: number)` → Doctor[]
                - `check_availability(doctorId: string, startUtc: string, endUtc: string, slotMinutes: number)` → Slot[]
                - `book_appointment(doctorId: string, startUtc: string, user: { name: string; email: string; phone?: string })` → { appointmentId, gcalEventId }
                - `geocode(query: string)` → { lat, lng, address }
                - `parse_message(message: string)` → { specialty?, location?, dateRange?, intent }

MCP server skeleton:

```ts
// apps/mcp/src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server";
import { z } from "zod";

const server = new Server({ name: "mcp-appointments", version: "0.1.0" });

server.tool("search_doctors", {
  input: z.object({ specialty: z.string(), near: z.object({ lat: z.number(), lng: z.number() }), radiusKm: z.number().optional() }),
  async run({ input }) {
    const res = await fetch(`${process.env.API_BASE_URL}/doctors/search?specialty=${encodeURIComponent(input.specialty)}&lat=${input.near.lat}&lng=${input.near.lng}&radiusKm=${input.radiusKm ?? 10}`, {
      headers: { "x-api-key": process.env.API_KEY! }
    });
    return await res.json();
  }
});
// ... define other tools similarly ...

server.start();
```

### 5) Mobile (`apps/mobile/`) — Expo (placeholder)

- Free STT/TTS:
                - TTS: `expo-speech`
                - STT: `react-native-voice` (platform speech APIs), or defer STT to the server if needed
- Shares `packages/shared` types; consumes the same API endpoints
- Keep voice optional for MVP; start with forms mirroring web

### 6) Shared Types (`packages/shared/`)

- Export zod schemas and TypeScript types for Doctor, Appointment, Slots, NLU entities
- Used by API (validation), Web/Mobile (type safety), MCP (tool IO validation)

### 7) Dev Experience (run all from one folder)

- Ports: api 4000, web 3000, mcp 5005, expo dev auto
- One command to run all:
                - `pnpm dev` → runs `apps/api`, `apps/web`, `apps/mcp` in parallel; mobile started separately with `pnpm --filter @mcp/mobile start`
- Example per-app scripts:
                - `apps/api/package.json`: `dev`: `tsx src/index.ts`
                - `apps/web/package.json`: `dev`: `next dev`
                - `apps/mcp/package.json`: `dev`: `tsx src/index.ts`
                - `apps/mobile/package.json`: `start`: `expo start`

### 8) CORS and Networking

- API CORS allow origins: `http://localhost:3000`, `exp://*` (RN dev), `http://localhost:5005` (if MCP HTTP)
- All privileged actions go through API; MCP only wraps API; never stores Google tokens itself

### 9) Free Voice & NLU Strategy

- Web: Browser Web Speech API for STT/TTS (no cost)
- Mobile: OS speech APIs via `react-native-voice` and `expo-speech`
- NLU: rule-based (chrono-node + dictionaries), optional local LLM via `OLLAMA_BASE_URL`

### 10) Deployment (later)

- Web: Vercel; API: Railway/Render; MCP: optional internal process
- OAuth redirect URIs updated for prod; secrets via env

### To-dos

- [ ] Scaffold Next.js 14 app with Tailwind and chat/voice shell
- [ ] Scaffold Express TS API with Prisma + SQLite
- [ ] Add Prisma models for Doctor, CalendarCredential, Appointment
- [ ] Implement Google OAuth (initiate/callback) and token storage
- [ ] Add endpoints to compute availability from Google free/busy
- [ ] Add booking endpoint to create calendar events and persist appointment
- [ ] Add doctor search endpoint with distance filter
- [ ] Implement rule-based NLU with chrono-node and specialty mapping
- [ ] Implement voice STT/TTS UI and stepwise booking flow
- [ ] Add geocoding proxy and browser geolocation integration
- [ ] Encrypt token storage and add validation/rate limiting