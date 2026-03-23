# GhostBuster Agent Platform

Two coordinated workstreams:

1. **Browser Observer + Voice Agent** – Chrome extension captures screenshot, DOM, and microphone audio → `POST /api/debug-session` streams Gemini 2.5 Flash reasoning via Vercel AI SDK `generateObject` and stores results in Supabase.
2. **Code Agent + Auto-Fix Pipeline** – `POST /api/code-agent` consumes the structured bug object, uses Gemini 2.5 Pro Experimental with tool calling (`read_file`, `write_file`, `list_files`, `deploy`) to patch Supabase-backed files and trigger a Vercel redeploy.

## Folders

- `src/app` – Next.js 14 App Router UI + API routes.
- `src/components` – Agent dashboard UI with Clerk auth + Supabase realtime feed.
- `src/lib` – Shared helpers (Supabase clients, Gemini model selectors, Vercel deploy helper, Zod schemas).
- `src/supabase` – Seeder script for demo components stored inside Supabase.
- `supabase/schema.sql` – Tables + policies for `debug_sessions` and `app_files`.
- `extension/` – Chrome extension for the Browser Observer workstream.
- `docs/architecture.md` – Text + diagram of the dual-agent flow.

## Env Vars (sample `.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
VERCEL_AI_GOOGLE_PROJECT_ID=
VERCEL_AI_GOOGLE_LOCATION=
VERCEL_AI_GOOGLE_API_KEY=
VERCEL_PROJECT_ID=
VERCEL_DEPLOY_TOKEN=
```

`VERCEL_AI_GOOGLE_*` are required for `@ai-sdk/google` provider. Leave them blank in git; fill locally.

## Scripts

- `npm run dev` – Next.js dev server with Clerk middleware.
- `npm run seed:supabase` – Pushes intentionally buggy demo components to Supabase `app_files`.

## Chrome Extension Pairing

1. Visit `chrome://extensions`, enable Developer Mode, click **Load unpacked** and select `extension/`.
2. Open options page → set `API Base URL` (`https://YOUR-DEPLOYMENT.vercel.app`) and optional Clerk session JWT.
3. Use `Cmd/Ctrl + Shift + G` to toggle capture. On stop it uploads screenshot/DOM/audio to `/api/debug-session` and streams the Gemini diagnosis to the Agent console.
