'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Play, RefreshCw } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Session = {
  id: string;
  screenshot_url: string | null;
  bug_description: string | null;
  affected_component: string | null;
  root_cause: string | null;
  suggested_diff: string | null;
  severity: string | null;
  confidence: number | null;
  fix_summary?: string | null;
  created_at?: string;
};

export function AgentDashboard() {
  const { data, mutate, isLoading } = useSWR<Session[]>('/api/diagnostics/history', fetcher, {
    refreshInterval: 20000
  });
  const [selected, setSelected] = useState<Session | null>(null);
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoFixStatus, setAutoFixStatus] = useState<string | null>(null);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && key ? createClient(url, key) : null;
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('debug-session-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debug_sessions' },
        () => mutate()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate, supabase]);

  useEffect(() => {
    if (data && data.length && !selected) {
      setSelected(data[0]);
    }
  }, [data, selected]);

  async function handleAutoFix(session?: Session | null) {
    if (!session) return;
    try {
      setAutoFixing(true);
      setAutoFixStatus('Triggering code agent…');
      const response = await fetch('/api/code-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setAutoFixStatus('Auto-fix loop running. Watch Supabase for updates…');
      await mutate();
    } catch (error) {
      console.error(error);
      setAutoFixStatus('Auto-fix failed. Check server logs.');
    } finally {
      setAutoFixing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sessions…
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[320px,1fr]">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <p className="text-sm uppercase tracking-[0.2em] text-brand-200">Timeline</p>
          <button
            onClick={() => mutate()}
            className="rounded-full border border-white/10 p-1 text-white/70 transition hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {data?.map((session) => (
            <li key={session.id}>
              <button
                onClick={() => setSelected(session)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selected?.id === session.id
                    ? 'border-brand-400 bg-brand-500/20'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <p className="font-semibold text-white">
                  {session.bug_description ?? 'Processing…'}
                </p>
                <p className="text-xs text-white/60">
                  {session.affected_component ?? 'Component pending'}
                </p>
              </button>
            </li>
          ))}
          {!data?.length && <p className="text-center text-sm text-white/60">No sessions yet.</p>}
        </ul>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent p-6">
        {selected ? (
          <div className="flex flex-col gap-6">
            {selected.screenshot_url ? (
              <div className="relative">
                <Image
                  src={selected.screenshot_url}
                  alt="Screenshot"
                  width={1200}
                  height={675}
                  className="rounded-xl border border-white/10"
                />
                <span className="absolute inset-0 rounded-xl border-4 border-rose-400/70 mix-blend-screen" />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/20">
                <p className="text-sm text-white/60">Waiting for screenshot upload…</p>
              </div>
            )}
            <section className="space-y-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-brand-200">Bug</p>
                <p className="text-lg font-semibold text-white/90">
                  {selected.bug_description ?? 'Analyzing via Gemini 2.5 Flash…'}
                </p>
              </div>
              <div className="grid gap-3 rounded-xl border border-white/10 bg-black/30 p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Component</p>
                  <p className="text-base text-white">{selected.affected_component ?? 'TBD'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Confidence</p>
                  <p className="text-base text-white">
                    {(selected.confidence ?? 0).toFixed(2)} ({selected.severity ?? 'medium'})
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Root Cause</p>
                <p className="text-sm text-white/80">{selected.root_cause ?? 'Model still reasoning…'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Suggested Fix</p>
                <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/60 p-4 text-xs text-white/90">
                  {selected.suggested_diff ?? 'Waiting on diff…'}
                </pre>
              </div>
              {selected.fix_summary && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  <p className="mb-1 font-semibold">Auto-fix applied</p>
                  <p>{selected.fix_summary}</p>
                </div>
              )}
              <button
                disabled={autoFixing}
                onClick={() => handleAutoFix(selected)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {autoFixing ? 'Auto-fixing…' : 'Run Auto-Fix Agent'}
              </button>
              {autoFixStatus && <p className="text-xs text-white/60">{autoFixStatus}</p>}
            </section>
          </div>
        ) : (
          <div className="flex h-96 items-center justify-center text-white/60">Select a session.</div>
        )}
      </div>
    </div>
  );
}
