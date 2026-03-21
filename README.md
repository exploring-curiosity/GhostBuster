# GhostBuster

**AI-powered bug detection and auto-fix pipeline.** A user reports a bug through a Chrome extension — capturing a screenshot, DOM snapshot, and voice description — and an autonomous agent diagnoses the issue, fixes the code in a sandboxed environment, commits the fix, deploys it, and closes the GitHub issue. End to end, zero human code changes.

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 1 — Chrome Extension (Bug Capture)                          │
│                                                                     │
│  User clicks extension icon / ⌘⇧G on buggy page                   │
│    → Screenshot captured (chrome.tabs.captureVisibleTab)            │
│    → DOM snapshot captured (chrome.scripting.executeScript)          │
│    → Voice recorded via MediaRecorder (offscreen document)          │
│    → Screenshot + audio + DOM sent to Gemini 2.5 Flash              │
│    → Gemini returns structured diagnosis (JSON)                     │
│    → Diagnosis POSTed to Phase 2 backend                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 2 — Agent Backend (Auto-Fix)                                │
│                                                                     │
│  POST /api/diagnose receives diagnosis                              │
│    → Stored in Supabase + screenshot uploaded to Storage            │
│    → GitHub issue created (with screenshot + diagnosis)             │
│    → Agent spawns Vercel Sandbox (clones repo, npm install)         │
│    → Agent reads files, writes fix, runs `npm run build`            │
│    → Build passes → commits to GitHub → triggers Vercel deploy      │
│    → GitHub issue closed with commit link                           │
│    → Live progress streamed to dashboard via Supabase Realtime      │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Extension** | Chrome MV3 (background service worker, offscreen document) |
| **Bug Capture** | `captureVisibleTab`, `executeScript` (DOM), `MediaRecorder` (voice) |
| **AI Diagnosis** | Gemini 2.5 Flash — multimodal (screenshot + audio + text) |
| **Backend** | Next.js 14 (App Router) |
| **Agent LLM** | Vercel AI SDK v3 + Gemini 2.5 Flash |
| **Sandbox** | Vercel Sandbox (Firecracker microVM) |
| **Database** | Supabase (Postgres + Realtime + Storage) |
| **Auth** | Clerk |
| **Repo Access** | Octokit (GitHub REST + Git Data API) |
| **Issue Tracking** | GitHub Issues (auto-created on diagnosis, auto-closed on fix) |
| **Deploy** | Vercel auto-deploy on push + deploy hooks |
| **Dashboard** | React + Supabase Realtime (live agent activity feed) |

## Features

- **Screenshot capture** — takes a PNG of the visible tab at the moment the bug is reported
- **DOM snapshot** — captures the full `document.documentElement.outerHTML` for context
- **Voice recording** — records the user's microphone via an offscreen document and sends audio to Gemini
- **Multimodal AI diagnosis** — Gemini 2.5 Flash analyzes screenshot + voice + DOM in a single request, returns structured JSON
- **Autonomous agent** — reads repo files, writes fixes, runs builds, deploys — all inside a Vercel Sandbox
- **GitHub Issues** — auto-creates an issue on diagnosis (with screenshot attached), auto-closes when fix is deployed
- **Live dashboard** — shows diagnosis queue, status timeline, and real-time agent activity (tool calls, file reads/writes, build output)
- **Auto-deploy control** — `AUTO_DEPLOY=true` (default) deploys immediately; set to `false` to require approval

## Project Structure

```
├── GhostBusterPhase1/extension/     # Chrome extension
│   ├── manifest.json                # MV3 manifest (activeTab, scripting, offscreen)
│   ├── background.js                # Orchestrator: capture, Gemini call, Phase 2 POST
│   ├── offscreen.html/js            # Mic recording via MediaRecorder
│   ├── options.html/js              # Settings: Gemini API key, Phase 2 URL, API key
│   ├── capture.html/js              # Text fallback when audio capture fails
│   └── popup.html/js                # (legacy, replaced by action click)
│
├── src/
│   ├── app/
│   │   ├── dashboard/page.tsx       # Live agent dashboard with Supabase Realtime
│   │   ├── api/diagnose/route.ts    # Intake endpoint (creates issue, triggers agent)
│   │   ├── api/dashboard/route.ts   # Dashboard data API
│   │   ├── api/agent/route.ts       # Agent streaming endpoint
│   │   └── api/webhook/route.ts     # Vercel deploy webhook
│   ├── lib/
│   │   ├── agent.ts                 # Agent orchestration (Gemini + tools + step logging)
│   │   ├── tools.ts                 # Agent tools: read_file, write_file, run_command, deploy
│   │   ├── sandbox.ts               # Vercel Sandbox: create, write files, run commands
│   │   ├── github.ts                # GitHub: repo tree, file ops, commits, issues
│   │   ├── supabase.ts              # Supabase: diagnoses, fixes, agent steps, screenshots
│   │   └── schemas.ts               # Zod schemas for all data types
│   └── middleware.ts                # Clerk auth
│
├── scripts/
│   ├── mock-diagnose.ts             # Send mock bug diagnosis for testing
│   └── reset-demo.ts               # Reset demo repo to buggy state
└── .env.example                     # All required environment variables
```

## Setup

1. Clone this repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in all values
4. Create Supabase tables (see SQL below)
5. Load the Chrome extension from `GhostBusterPhase1/extension/`
6. `npm run dev`

## Supabase SQL

Run in the Supabase SQL editor:

```sql
CREATE TABLE diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  screenshot_url TEXT,
  dom_snapshot TEXT,
  voice_transcript TEXT,
  gemini_analysis JSONB,
  page_url TEXT,
  viewport JSONB,
  status TEXT DEFAULT 'pending',
  github_issue_number INTEGER,
  auto_deploy BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID REFERENCES diagnoses(id),
  files_changed JSONB,
  commit_sha TEXT,
  deploy_url TEXT,
  agent_reasoning TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL,
  step_number INTEGER NOT NULL,
  tool_name TEXT,
  tool_input TEXT,
  tool_output TEXT,
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_diagnoses" ON diagnoses FOR ALL USING (true);
CREATE POLICY "all_fixes" ON fixes FOR ALL USING (true);
CREATE POLICY "all_agent_steps" ON agent_steps FOR ALL USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE diagnoses;
ALTER PUBLICATION supabase_realtime ADD TABLE fixes;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_steps;
```

Also create a Supabase Storage bucket called `diagnosis-assets` (public).

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/diagnose` | POST | `X-API-Key` header | Receives diagnosis from extension, creates GitHub issue, triggers agent |
| `/api/agent` | POST | Clerk | Streams agent reasoning/tool calls |
| `/api/dashboard` | GET | Public | Returns diagnoses, agent steps, fixes for dashboard |
| `/api/webhook` | POST | — | Vercel deploy status webhook |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run mock:bug1` | Send Bug #1 (pointer-events-none) |
| `npm run mock:bug2` | Send Bug #2 (responsive grid) |
| `npm run mock:bug3` | Send Bug #3 (missing form handler) |
| `npm run mock:bug4` | Send Bug #4 (z-index dropdown) |
| `npm run reset-demo` | Reset main branch to bkp (restores all bugs) |

## Target Demo Repo

The agent targets: [`exploring-curiosity/GhostBusterDemo`](https://github.com/exploring-curiosity/GhostBusterDemo)

## Environment Variables

See `.env.example` for the full list. Key variables:

- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini API key
- `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` — target repo
- `VERCEL_TOKEN` / `VERCEL_TEAM_ID` / `VERCEL_PROJECT_ID` — Vercel Sandbox auth
- `VERCEL_DEPLOY_HOOK_URL` — triggers Vercel redeploy after commit
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase backend access
- `AUTO_DEPLOY` — `true` (default) or `false` to require approval before deploy
- `DIAGNOSE_API_KEY` — shared secret between extension and backend