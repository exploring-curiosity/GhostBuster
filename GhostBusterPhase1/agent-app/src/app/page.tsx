import Link from 'next/link';

const features = [
  {
    title: 'Chrome Observer',
    body: 'Keyboard shortcut or toolbar click captures screenshot, DOM, and live mic audio in one sweep.'
  },
  {
    title: 'Gemini Multimodal Brain',
    body: 'Streams diagnoses via Vercel AI SDK generateObject with a strict Zod schema for bug reports.'
  },
  {
    title: 'Auto-Fix Loop',
    body: 'Supabase-backed source files are patched via Gemini tool-calling and redeployed on Vercel.'
  }
];

const steps = [
  'Install the Chrome extension and save your API base URL + Clerk token.',
  'Press your shortcut (or click the toolbar icon) to capture the page and voice notes.',
  'Watch the Agent Console stream the diagnosis, then trigger the Code Agent to redeploy.'
];

export default function Home() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-brand-900/40 p-10 text-center shadow-[0_0_60px_rgba(6,24,44,0.6)]">
        <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(circle_at_top,_rgba(27,140,255,0.15),_transparent_60%)]" />
        <p className="text-sm uppercase tracking-[0.3em] text-brand-200">GhostBuster 2026</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
          Debug visually. Fix automatically.
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-base text-slate-300">
          We pair a Browser Observer Chrome extension with a Gemini-powered Auto-Fix pipeline so you
          can capture bugs in seconds, understand the root cause, and push a Vercel redeploy without
          leaving the tab.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/agent"
            className="rounded-full bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-500/40 transition hover:bg-brand-400"
          >
            Launch Agent Console
          </Link>
          <a
            href="https://vercel.com/docs/ai"
            target="_blank"
            className="rounded-full border border-white/20 px-6 py-3 text-base font-semibold text-white/80 transition hover:border-white/60"
          >
            Sponsor Docs
          </a>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-inner shadow-black/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-brand-200">{feature.title}</p>
            <p className="mt-3 text-base text-white/90">{feature.body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-brand-200">Workflow</p>
          <h2 className="mt-2 text-2xl font-semibold">From screen to shipping in three beats</h2>
          <ol className="mt-6 space-y-6">
            {steps.map((step, idx) => (
              <li key={step} className="flex gap-4">
                <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-sm font-semibold text-brand-200">
                  {idx + 1}
                </span>
                <p className="text-base text-white/90">{step}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/40 p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-brand-200">Integrations</p>
          <div className="mt-4 space-y-4 text-sm text-white/80">
            <p>
              <span className="font-semibold text-white">Gemini 2.5 Flash + Pro:</span> multimodal
              diagnosis plus tool-calling auto-fixes.
            </p>
            <p>
              <span className="font-semibold text-white">Vercel AI SDK:</span> streaming UI feedback
              with generateObject + generateText.
            </p>
            <p>
              <span className="font-semibold text-white">Clerk & Supabase:</span> secure auth,
              history timelines, storage, and realtime notifications.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
