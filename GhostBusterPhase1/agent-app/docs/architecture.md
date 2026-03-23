# GhostBuster Architecture

## High-Level Flow

```
Chrome Extension -> Vercel Edge (Next API) -> Gemini 2.5 Flash -> Supabase (sessions + storage)
                                                                -> Agent Console React UI
                                                                -> Code Agent Tool Loop -> Supabase app_files -> Vercel Deploy
```

### Workstream A – Browser Observer + Voice Agent
1. **Capture** – The Chrome extension listens for `Ctrl/Cmd + Shift + G`.
   - Uses `chrome.tabs.captureVisibleTab` for a PNG screenshot.
   - Injects `capture-dom.js` content script to pull `document.documentElement.outerHTML`.
   - Opens a `MediaRecorder` on the active tab for microphone audio and stops on shortcut toggle.
2. **Payload** – The extension sends `{ screenshotBase64, domSnapshot, audioBase64, voiceSummary }` to `POST /api/debug-session` with the Clerk session token header.
3. **Multimodal Reasoning** – The API route streams `generateObject` via Vercel AI SDK + `@ai-sdk/google` `gemini-2.5-flash`.
   - Inputs: screenshot (vision), DOM text, audio blob, optional typed summary.
   - Schema: `bugDescription, affectedComponent, rootCause, suggestedDiff, severity, confidence`.
4. **Persistence** – Assets upload to Supabase Storage `debug-assets`; structured result saved to `debug_sessions` table.
5. **Interface** – The Clerk-gated `/agent` page subscribes to Supabase Realtime for `debug_sessions` updates and renders streaming progress with Tailwind UI overlay.

### Workstream B – Code Agent + Auto-Fix Pipeline
1. **Source of Truth** – Each component of the demo Next.js app is stored in Supabase `app_files (file_path, content)`.
2. **Tool Calling Loop** – `POST /api/code-agent` loads the session row and invokes `streamText` using `gemini-2.5-pro-exp` with tools:
   - `list_files` → structure overview
   - `read_file` → fetch code from Supabase
   - `write_file` → persist updated code
   - `deploy` → fire Vercel deployment via REST API
3. **Stop-When** – The API accepts `stopWhen` to cap tool round trips (default 4) mirroring Vercel “stop when” sponsor feature.
4. **Redeploy feedback** – After `deploy`, the payload stores `fix_summary` + tool trace on `debug_sessions`. Supabase Realtime notifies the Agent UI and extension.
5. **Demo Bugs** – Seeds populate `components/NavBar.tsx`, `ShowcaseGrid.tsx`, `ContactForm.tsx` with visual defects (z-index, hover overlay, missing submit handler) for live debugging.

### Integrations Checklist
- ✅ Vercel AI SDK `generateObject` + `streamObject` for Gemini 2.5 Flash
- ✅ Vercel AI SDK `streamText` + tool calling for Gemini 2.5 Pro Experimental
- ✅ Clerk session middleware + UI gating
- ✅ Supabase DB, storage, realtime subscriptions, and file-backed demo app
- ✅ Vercel Deployment API hook for auto-fix pipeline
- ✅ Supabase Storage for screenshot/audio artifacts with history view
