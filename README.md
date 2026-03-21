# GhostBuster Agent — Phase 2 Backend

Autonomous coding agent that receives bug diagnoses from the Chrome Extension (Phase 1) and fixes code in an E2B sandbox, then deploys via GitHub → Vercel.

## Architecture

```
[Chrome Extension] → POST /api/diagnose → [Supabase] → [Agent (Gemini 2.5 Flash)]
                                                              ↓
                                                    [E2B Sandbox: clone, fix, build]
                                                              ↓
                                                    [GitHub commit] → [Vercel auto-deploy]
```

## Setup

1. Clone this repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in all values
4. Create Supabase tables (see SQL below)
5. `npm run dev`

## Supabase SQL

Run this in your Supabase SQL editor:

```sql
create table diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  screenshot_url text,
  dom_snapshot text,
  voice_transcript text,
  gemini_analysis jsonb,
  page_url text,
  viewport jsonb,
  status text default 'pending',
  created_at timestamptz default now()
);

create table fixes (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid references diagnoses(id),
  files_changed jsonb,
  commit_sha text,
  deploy_url text,
  agent_reasoning text,
  status text default 'pending',
  created_at timestamptz default now()
);
```

Also create a Supabase Storage bucket called `diagnosis-assets` (public).

## API Endpoints

### `POST /api/diagnose`
Receives diagnosis from Phase 1. Requires `X-API-Key` header.

### `POST /api/agent`
Streams agent reasoning/tool calls. Protected by Clerk auth.

### `POST /api/webhook`
Receives Vercel deploy status webhooks.

## Environment Variables

See `.env.example` for the full list.

## Target Demo Repo

The agent targets: `exploring-curiosity/GhostBusterDemo`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Agent | Vercel AI SDK v3 + Gemini 2.5 Flash |
| Sandbox | Vercel Sandbox |
| Database | Supabase |
| Auth | Clerk |
| Repo Access | Octokit (GitHub REST + Git Data API) |
| Deploy | Vercel auto-deploy on push |


npm run mock:bug1	Send Bug #1 (pointer-events-none)
npm run mock:bug2	Send Bug #2 (responsive grid)
npm run mock:bug3	Send Bug #3 (missing form handler)
npm run mock:bug4	Send Bug #4 (z-index dropdown)
npm run reset-demo	Reset main branch to bkp (restores all bugs)