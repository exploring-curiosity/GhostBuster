"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Diagnosis {
  id: string;
  status: string;
  page_url: string;
  gemini_analysis: {
    bug_description: string;
    affected_component: string;
    root_cause: string;
    suggested_fix: string;
  };
  screenshot_url: string | null;
  voice_transcript: string;
  created_at: string;
}

interface AgentStep {
  id: string;
  diagnosis_id: string;
  step_number: number;
  tool_name: string | null;
  tool_input: string | null;
  tool_output: string | null;
  reasoning: string | null;
  created_at: string;
}

interface Fix {
  id: string;
  diagnosis_id: string;
  files_changed: { path: string; content: string }[];
  commit_sha: string | null;
  agent_reasoning: string;
  status: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: "Queued", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", icon: "⏳" },
  fixing: { label: "Fixing", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", icon: "🔧" },
  deploying: { label: "Deploying", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20", icon: "🚀" },
  deployed: { label: "Deployed", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20", icon: "✅" },
  failed: { label: "Failed", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20", icon: "❌" },
};

const TOOL_ICONS: Record<string, string> = {
  system: "⚡",
  read_file: "📄",
  list_files: "📁",
  write_file: "✏️",
  run_command: "💻",
  deploy: "🚀",
  reasoning: "🧠",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatusTimeline({ status }: { status: string }) {
  const stages = ["pending", "fixing", "deploying", "deployed"];
  const currentIdx = stages.indexOf(status);
  const isFailed = status === "failed";

  return (
    <div className="flex items-center gap-1 w-full">
      {stages.map((s, i) => {
        const cfg = STATUS_CONFIG[s];
        const isActive = i <= currentIdx && !isFailed;
        const isCurrent = i === currentIdx;
        return (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`h-2 w-full rounded-full transition-all duration-500 ${
                isActive ? (isCurrent && s === "fixing" ? "bg-blue-400 animate-pulse" : `bg-${cfg.color.replace("text-", "")}`) : "bg-gray-700"
              }`}
              style={{
                backgroundColor: isActive
                  ? s === "pending" ? "#fbbf24" : s === "fixing" ? "#60a5fa" : s === "deploying" ? "#a78bfa" : "#34d399"
                  : isFailed && i <= currentIdx ? "#f87171" : "#374151",
              }}
            />
            <span className={`text-[10px] ${isActive ? "text-gray-300" : "text-gray-600"}`}>{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StepEntry({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[step.tool_name || ""] || "🔹";
  const time = new Date(step.created_at).toLocaleTimeString();

  let summary = "";
  if (step.tool_name === "read_file") {
    try { summary = `Reading ${JSON.parse(step.tool_input || "{}").path}`; } catch { summary = "Reading file"; }
  } else if (step.tool_name === "write_file") {
    try { summary = `Writing ${JSON.parse(step.tool_input || "{}").path}`; } catch { summary = "Writing file"; }
  } else if (step.tool_name === "run_command") {
    try { summary = `$ ${JSON.parse(step.tool_input || "{}").command}`; } catch { summary = "Running command"; }
  } else if (step.tool_name === "list_files") {
    summary = "Listing repository files";
  } else if (step.tool_name === "deploy") {
    try { summary = `Deploying: ${JSON.parse(step.tool_input || "{}").commit_message}`; } catch { summary = "Deploying fix"; }
  } else if (step.tool_name === "system") {
    summary = step.reasoning || "System event";
  } else if (step.tool_name === "reasoning") {
    summary = step.reasoning?.slice(0, 120) || "Thinking...";
  } else {
    summary = step.tool_name || "Step";
  }

  return (
    <div
      className="group border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500">#{step.step_number}</span>
            <span className="text-sm text-gray-200 truncate">{summary}</span>
          </div>
          <span className="text-[10px] text-gray-600">{time}</span>
        </div>
        <span className="text-gray-600 text-xs">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2">
          {step.reasoning && (
            <div className="text-xs text-gray-400 bg-gray-900 rounded p-2 whitespace-pre-wrap">{step.reasoning}</div>
          )}
          {step.tool_input && (
            <div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Input</span>
              <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2 overflow-x-auto max-h-40">{formatJson(step.tool_input)}</pre>
            </div>
          )}
          {step.tool_output && (
            <div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Output</span>
              <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2 overflow-x-auto max-h-40">{formatJson(step.tool_output)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatJson(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function timeAgo(date: string) {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

export default function Dashboard() {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [fix, setFix] = useState<Fix | null>(null);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (id?: string) => {
    const url = id ? `/api/dashboard?id=${id}` : "/api/dashboard";
    const res = await fetch(url);
    const data = await res.json();
    setDiagnoses(data.diagnoses);
    if (id) {
      setSteps(data.steps);
      setFix(data.fix);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch details when selected
  useEffect(() => {
    if (selectedId) fetchData(selectedId);
  }, [selectedId, fetchData]);

  // Auto-select the latest "fixing" diagnosis
  useEffect(() => {
    if (!selectedId && diagnoses.length > 0) {
      const fixing = diagnoses.find((d) => d.status === "fixing");
      setSelectedId(fixing?.id || diagnoses[0].id);
    }
  }, [diagnoses, selectedId]);

  // Supabase Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "diagnoses" },
        () => { fetchData(selectedId || undefined); }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_steps" },
        (payload) => {
          const newStep = payload.new as AgentStep;
          if (newStep.diagnosis_id === selectedId) {
            setSteps((prev) => [...prev, newStep]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fixes" },
        () => { if (selectedId) fetchData(selectedId); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId, fetchData]);

  // Auto-scroll steps
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps]);

  const selected = diagnoses.find((d) => d.id === selectedId);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
        <h1 className="text-lg font-semibold tracking-tight">
          Ghost<span className="text-emerald-400">Buster</span> Dashboard
        </h1>
        <span className="text-xs text-gray-500 ml-auto">
          {diagnoses.length} diagnosis{diagnoses.length !== 1 ? "es" : ""}
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Diagnosis Queue */}
        <aside className="w-80 border-r border-gray-800 overflow-y-auto">
          <div className="p-3 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Queue</h2>
          </div>
          <div className="divide-y divide-gray-800/50">
            {diagnoses.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`w-full text-left p-3 hover:bg-gray-900/50 transition-colors ${
                  d.id === selectedId ? "bg-gray-900 border-l-2 border-emerald-400" : "border-l-2 border-transparent"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <StatusBadge status={d.status} />
                  <span className="text-[10px] text-gray-600">{timeAgo(d.created_at)}</span>
                </div>
                <p className="text-sm text-gray-300 truncate">
                  {d.gemini_analysis?.bug_description || "Pending analysis..."}
                </p>
                <p className="text-[11px] text-gray-600 truncate mt-0.5 font-mono">{d.id.slice(0, 8)}</p>
              </button>
            ))}
            {diagnoses.length === 0 && (
              <div className="p-8 text-center text-gray-600 text-sm">
                No diagnoses yet. Use the extension to capture a bug.
              </div>
            )}
          </div>
        </aside>

        {/* Main Panel */}
        <main className="flex-1 overflow-y-auto">
          {selected ? (
            <div className="p-6 space-y-6">
              {/* Status Timeline */}
              <div>
                <StatusTimeline status={selected.status} />
              </div>

              {/* Diagnosis Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bug Diagnosis</h3>
                  <p className="text-sm text-gray-200">{selected.gemini_analysis?.bug_description}</p>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-gray-500">Component: </span>
                      <span className="text-gray-300">{selected.gemini_analysis?.affected_component}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Root cause: </span>
                      <span className="text-gray-300">{selected.gemini_analysis?.root_cause}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Suggested fix: </span>
                      <span className="text-gray-300">{selected.gemini_analysis?.suggested_fix}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</h3>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-gray-500">Page: </span>
                      <span className="text-blue-400 font-mono">{selected.page_url}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">User said: </span>
                      <span className="text-gray-300 italic">&quot;{selected.voice_transcript}&quot;</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ID: </span>
                      <span className="text-gray-400 font-mono text-[11px]">{selected.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Created: </span>
                      <span className="text-gray-400">{new Date(selected.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {selected.screenshot_url && (
                    <img
                      src={selected.screenshot_url}
                      alt="Screenshot"
                      className="w-full rounded-lg border border-gray-700 mt-2"
                    />
                  )}
                </div>
              </div>

              {/* Fix Info */}
              {fix && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fix Result</h3>
                  <div className="flex items-center gap-3 text-sm">
                    <StatusBadge status={fix.status === "success" ? "deployed" : fix.status} />
                    {fix.commit_sha && (
                      <a
                        href={`https://github.com/${process.env.NEXT_PUBLIC_GITHUB_OWNER || "exploring-curiosity"}/${process.env.NEXT_PUBLIC_GITHUB_REPO || "GhostBusterDemo"}/commit/${fix.commit_sha}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 font-mono text-xs hover:underline"
                      >
                        {fix.commit_sha.slice(0, 7)}
                      </a>
                    )}
                  </div>
                  {fix.files_changed?.length > 0 && (
                    <div className="text-xs text-gray-400">
                      Files changed: {fix.files_changed.map((f) => f.path).join(", ")}
                    </div>
                  )}
                </div>
              )}

              {/* Agent Steps — Live Feed */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent Activity</h3>
                  {selected.status === "fixing" && (
                    <span className="flex items-center gap-1 text-[10px] text-blue-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      Live
                    </span>
                  )}
                  <span className="text-[10px] text-gray-600 ml-auto">{steps.length} steps</span>
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {steps.length === 0 && selected.status === "pending" && (
                    <div className="text-sm text-gray-600 text-center py-4">
                      Waiting for agent to start...
                    </div>
                  )}
                  {steps.length === 0 && selected.status === "fixing" && (
                    <div className="text-sm text-blue-400 text-center py-4 animate-pulse">
                      Agent is initializing sandbox...
                    </div>
                  )}
                  {steps.map((step) => (
                    <StepEntry key={step.id} step={step} />
                  ))}
                  <div ref={stepsEndRef} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              Select a diagnosis from the queue to view details.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
