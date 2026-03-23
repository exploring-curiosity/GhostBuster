import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { AgentDashboard } from '@/components/AgentDashboard';

const setupSteps = [
  'Install the GhostBuster Chrome extension and set the API base URL + Clerk token.',
  'Pick a shortcut (or click the toolbar icon) to capture screenshot, DOM, and audio.',
  'Watch the diagnosis stream in, then hit Auto-Fix to trigger the Gemini tool loop.'
];

const liveTips = [
  'Keep the Agent console open while you speak so streaming UI stays in sync.',
  'Use the Sonar tab (coming up next) to watch Vercel deploys in real time.',
  'Need to rerun? Click “Reset extension” from the options menu to clear settings.'
];

export default function AgentPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-brand-200">GhostBuster</p>
          <h1 className="text-2xl font-semibold">Agent Ops Console</h1>
          <p className="text-sm text-white/70">
            Live diagnoses, auto-fix orchestration, and history timelines—secured by Clerk.
          </p>
        </div>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
        <SignedOut>
          <SignInButton afterSignInUrl="/agent" />
        </SignedOut>
      </header>

      <SignedIn>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),320px]">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <AgentDashboard />
          </div>
          <aside className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-brand-200">Quick start</p>
              <ul className="mt-4 space-y-4 text-sm text-white/80">
                {setupSteps.map((step) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-brand-400" />
                    <p>{step}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-brand-200">Live tips</p>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                {liveTips.map((tip) => (
                  <li key={tip} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </SignedIn>

      <SignedOut>
        <div className="rounded-2xl border border-dashed border-white/20 bg-black/30 p-8 text-center text-sm text-white/70">
          Sign in with Clerk to pair your extension and start streaming sessions.
        </div>
      </SignedOut>
    </main>
  );
}
