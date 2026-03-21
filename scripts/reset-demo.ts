/**
 * Reset the demo repo's main branch to the backup branch (with all bugs).
 * Uses raw GitHub REST API (fetch) to avoid Octokit ESM issues with tsx.
 *
 * Usage:
 *   npx tsx scripts/reset-demo.ts
 */

// Load .env.local manually since tsx doesn't auto-load it
import { readFileSync } from "fs";
import { join } from "path";
try {
  const envPath = join(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch (e) { console.error("Warning: could not load .env.local", e); }

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const OWNER = process.env.GITHUB_OWNER || "exploring-curiosity";
const REPO = process.env.GITHUB_REPO || "GhostBusterDemo";
const API = "https://api.github.com";

async function ghFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...((opts.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

async function main() {
  if (!GITHUB_TOKEN) {
    console.error("❌ GITHUB_TOKEN env var required.");
    process.exit(1);
  }

  console.log(`\n🔄 Resetting ${OWNER}/${REPO} main → bkp branch...\n`);

  // Get bkp branch SHA
  const bkpRef = await ghFetch(`/repos/${OWNER}/${REPO}/git/ref/heads/bkp`);
  const bkpSha: string = bkpRef.object.sha;
  console.log(`   bkp branch SHA: ${bkpSha}`);

  // Force-update main to bkp's SHA
  await ghFetch(`/repos/${OWNER}/${REPO}/git/refs/heads/main`, {
    method: "PATCH",
    body: JSON.stringify({ sha: bkpSha, force: true }),
  });

  console.log(`   ✅ main branch reset to bkp (${bkpSha.slice(0, 7)})`);

  // Trigger Vercel deploy hook to redeploy the buggy version
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (deployHookUrl) {
    await fetch(deployHookUrl, { method: "POST" });
    console.log(`   🚀 Vercel deploy hook triggered`);
  }

  console.log(`\n✅ Demo repo reset complete. All 4 bugs are back.\n`);
}

main().catch((err) => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
