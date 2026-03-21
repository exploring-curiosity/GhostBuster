import { z } from "zod";
import { tool } from "ai";
import { getFileContent, listDirectory, commitFiles, closeGitHubIssue } from "./github";
import { writeFileInSandbox, runCommandInSandbox } from "./sandbox";
import { updateDiagnosisStatus, createFix, updateFix, getDiagnosis } from "./supabase";
import type { Sandbox } from "./sandbox";
import type { FileChange } from "./schemas";

export interface ToolContext {
  sandbox: Sandbox;
  diagnosisId: string;
  filesChanged: FileChange[];
}

export function createAgentTools(ctx: ToolContext) {
  return {
    read_file: tool({
      description: "Read a file from the GitHub repo. Returns the full file content.",
      parameters: z.object({
        path: z.string().describe("File path relative to repo root, e.g. 'src/app/page.tsx'"),
      }),
      execute: async ({ path }: { path: string }) => {
        try {
          const content = await getFileContent(path);
          return { success: true, content };
        } catch (err) {
          return { success: false, error: `Failed to read ${path}: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    list_files: tool({
      description: "List all files in a directory of the GitHub repo.",
      parameters: z.object({
        directory: z.string().default("/").describe("Directory path relative to repo root"),
      }),
      execute: async ({ directory }: { directory: string }) => {
        try {
          const files = await listDirectory(directory);
          return { success: true, files };
        } catch (err) {
          return { success: false, error: `Failed to list ${directory}: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    write_file: tool({
      description: "Write or update a file in the sandbox. Use this to apply your fix.",
      parameters: z.object({
        path: z.string().describe("File path relative to repo root"),
        content: z.string().describe("The complete new file content"),
      }),
      execute: async ({ path, content }: { path: string; content: string }) => {
        try {
          await writeFileInSandbox(ctx.sandbox, path, content);
          const idx = ctx.filesChanged.findIndex((f) => f.path === path);
          if (idx >= 0) {
            ctx.filesChanged[idx].content = content;
          } else {
            ctx.filesChanged.push({ path, content });
          }
          return { success: true, message: `Written ${path} to sandbox` };
        } catch (err) {
          return { success: false, error: `Failed to write ${path}: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    run_command: tool({
      description: "Run a shell command in the sandbox (e.g. 'npm run build'). Returns stdout/stderr.",
      parameters: z.object({
        command: z.string().describe("Shell command to run"),
      }),
      execute: async ({ command }: { command: string }) => {
        try {
          const result = await runCommandInSandbox(ctx.sandbox, command);
          return {
            success: result.exitCode === 0,
            exitCode: result.exitCode,
            stdout: result.stdout.slice(0, 5000),
            stderr: result.stderr.slice(0, 3000),
          };
        } catch (err) {
          return { success: false, error: `Command failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    deploy: tool({
      description: "Commit all changed files to GitHub, triggering Vercel auto-deploy. Only call after build passes.",
      parameters: z.object({
        commit_message: z.string().describe("Descriptive commit message for the fix"),
      }),
      execute: async ({ commit_message }: { commit_message: string }) => {
        try {
          if (ctx.filesChanged.length === 0) {
            return { success: false, error: "No files have been changed" };
          }

          // Check auto_deploy flag (default: true)
          const autoDeploy = process.env.AUTO_DEPLOY !== "false";
          if (!autoDeploy) {
            // Check per-diagnosis override
            const diag = await getDiagnosis(ctx.diagnosisId);
            if (diag && diag.auto_deploy === false) {
              await updateDiagnosisStatus(ctx.diagnosisId, "deploying");
              return {
                success: true,
                awaiting_approval: true,
                message: "Fix ready. Awaiting user approval to deploy.",
                files_ready: ctx.filesChanged.map((f) => f.path),
              };
            }
          }

          await updateDiagnosisStatus(ctx.diagnosisId, "deploying");

          const commitSha = await commitFiles(ctx.filesChanged, commit_message);

          // Trigger Vercel deploy hook if configured
          const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
          if (deployHookUrl) {
            await fetch(deployHookUrl, { method: "POST" }).catch((e) =>
              console.warn("[Deploy] Deploy hook trigger failed:", e)
            );
          }

          const fixId = await createFix({
            diagnosis_id: ctx.diagnosisId,
            files_changed: ctx.filesChanged,
            agent_reasoning: commit_message,
          });
          await updateFix(fixId, { status: "success", commit_sha: commitSha });
          await updateDiagnosisStatus(ctx.diagnosisId, "deployed");

          // Close GitHub issue if one was created
          try {
            const diag = await getDiagnosis(ctx.diagnosisId);
            if (diag?.github_issue_number) {
              await closeGitHubIssue(
                diag.github_issue_number,
                commitSha,
                ctx.filesChanged.map((f) => f.path)
              );
              console.log(`[Deploy] GitHub issue #${diag.github_issue_number} closed`);
            }
          } catch (issueErr) {
            console.error("[Deploy] Failed to close GitHub issue:", issueErr);
          }

          return {
            success: true,
            commit_sha: commitSha,
            files_deployed: ctx.filesChanged.map((f) => f.path),
            message: "Fix committed, deployed, and GitHub issue closed.",
          };
        } catch (err) {
          await updateDiagnosisStatus(ctx.diagnosisId, "failed").catch(() => {});
          return { success: false, error: `Deploy failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),
  };
}
