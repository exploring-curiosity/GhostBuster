export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          Ghost<span className="text-emerald-400">Buster</span> Agent
        </h1>
        <p className="text-gray-400 text-lg">
          Autonomous coding agent that receives bug diagnoses from the Chrome Extension
          and fixes code in a sandboxed environment.
        </p>
        <div className="flex gap-4 justify-center text-sm">
          <code className="bg-gray-800 px-4 py-2 rounded-lg text-emerald-400">
            POST /api/diagnose
          </code>
          <code className="bg-gray-800 px-4 py-2 rounded-lg text-emerald-400">
            POST /api/agent
          </code>
          <code className="bg-gray-800 px-4 py-2 rounded-lg text-emerald-400">
            POST /api/webhook
          </code>
        </div>
        <a
          href="/dashboard"
          className="inline-block mt-4 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors"
        >
          Open Dashboard
        </a>
      </div>
    </div>
  );
}
