import { generateText, streamText } from "ai";
import { google } from "@ai-sdk/google";
import { createAgentTools, type ToolContext } from "./tools";
import { createSandbox, teardownSandbox } from "./sandbox";
import { getRepoTree } from "./github";
import { updateDiagnosisStatus, getDiagnosis, logAgentStep } from "./supabase";
import type { DiagnosisRow } from "./schemas";

const MAX_STEPS = 10;

function buildSystemPrompt(repoTree: string[], diagnosis: DiagnosisRow): string {
  return `You are an autonomous coding agent. You receive a bug diagnosis with a screenshot analysis and your job is to fix the bug in the codebase.

## Your Process
1. Read the relevant files from the repo to understand the current code
2. Identify the exact location of the bug based on the diagnosis
3. Write the fixed file(s) to the sandbox
4. Run \`npm run build\` to verify no build errors
5. If the build fails, read the error, adjust your fix, and try again
6. Once the build passes, deploy the fix

## Bug Diagnosis
- **Description**: ${diagnosis.gemini_analysis.bug_description}
- **Affected Component**: ${diagnosis.gemini_analysis.affected_component}
- **Root Cause**: ${diagnosis.gemini_analysis.root_cause}
- **Suggested Fix**: ${diagnosis.gemini_analysis.suggested_fix}
- **Page URL**: ${diagnosis.page_url}

## Voice Transcript from User
${diagnosis.voice_transcript}

## Repository File Tree
\`\`\`
${repoTree.join("\n")}
\`\`\`

## Rules
- Only modify files that are directly related to the bug
- Make minimal, targeted changes — do not refactor unrelated code
- Always run \`npm run build\` before deploying
- If the build fails 3 times, stop and report the failure
- Write clear commit messages that describe what was fixed
- Do NOT remove or alter comments unrelated to the bug`;
}

export async function runAgent(diagnosisId: string): Promise<void> {
  const diagnosis = await getDiagnosis(diagnosisId);
  if (!diagnosis) throw new Error(`Diagnosis ${diagnosisId} not found`);

  await updateDiagnosisStatus(diagnosisId, "fixing");

  const repoUrl = `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}.git`;
  const sandbox = await createSandbox(repoUrl, process.env.GITHUB_TOKEN);

  const toolContext: ToolContext = {
    sandbox,
    diagnosisId,
    filesChanged: [],
  };

  try {
    const repoTree = await getRepoTree();
    const systemPrompt = buildSystemPrompt(repoTree, diagnosis);
    const tools = createAgentTools(toolContext);

    // Log initial step
    await logAgentStep({
      diagnosis_id: diagnosisId,
      step_number: 0,
      tool_name: "system",
      reasoning: "Agent started. Analyzing bug diagnosis and preparing fix...",
    });

    let stepCounter = 0;

    const result = await generateText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please fix the bug described in the diagnosis. Start by reading the affected files, then make the fix, verify with a build, and deploy.",
            },
            ...(diagnosis.screenshot_url
              ? [{ type: "image" as const, image: diagnosis.screenshot_url }]
              : []),
          ],
        },
      ],
      tools,
      maxSteps: MAX_STEPS,
      onStepFinish: async (step) => {
        stepCounter++;
        const toolCalls = step.toolCalls || [];
        const toolResults = step.toolResults || [];
        for (let i = 0; i < toolCalls.length; i++) {
          const tc = toolCalls[i];
          const tr = toolResults[i];
          await logAgentStep({
            diagnosis_id: diagnosisId,
            step_number: stepCounter,
            tool_name: tc.toolName,
            tool_input: JSON.stringify(tc.args),
            tool_output: tr ? JSON.stringify(tr.result) : undefined,
            reasoning: step.text || undefined,
          });
        }
        if (toolCalls.length === 0 && step.text) {
          await logAgentStep({
            diagnosis_id: diagnosisId,
            step_number: stepCounter,
            tool_name: "reasoning",
            reasoning: step.text,
          });
        }
      },
    });

    console.log("[Agent] Completed with", result.steps.length, "steps");
    console.log("[Agent] Final text:", result.text);
  } catch (err) {
    console.error("[Agent] Error:", err);
    await updateDiagnosisStatus(diagnosisId, "failed").catch(() => {});
    throw err;
  } finally {
    await teardownSandbox(sandbox);
  }
}

export async function runAgentStream(diagnosisId: string) {
  const diagnosis = await getDiagnosis(diagnosisId);
  if (!diagnosis) throw new Error(`Diagnosis ${diagnosisId} not found`);

  await updateDiagnosisStatus(diagnosisId, "fixing");

  const repoUrl = `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}.git`;
  const sandbox = await createSandbox(repoUrl, process.env.GITHUB_TOKEN);

  const toolContext: ToolContext = {
    sandbox,
    diagnosisId,
    filesChanged: [],
  };

  const repoTree = await getRepoTree();
  const systemPrompt = buildSystemPrompt(repoTree, diagnosis);
  const tools = createAgentTools(toolContext);

  // Log initial step
  await logAgentStep({
    diagnosis_id: diagnosisId,
    step_number: 0,
    tool_name: "system",
    reasoning: "Agent started. Analyzing bug diagnosis and preparing fix...",
  });

  let stepCounter = 0;

  const result = await streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please fix the bug described in the diagnosis. Start by reading the affected files, then make the fix, verify with a build, and deploy.",
          },
          ...(diagnosis.screenshot_url
            ? [{ type: "image" as const, image: diagnosis.screenshot_url }]
            : []),
        ],
      },
    ],
    tools,
    maxSteps: MAX_STEPS,
    onStepFinish: async (step) => {
      stepCounter++;
      const toolCalls = step.toolCalls || [];
      const toolResults = step.toolResults || [];
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const tr = toolResults[i];
        await logAgentStep({
          diagnosis_id: diagnosisId,
          step_number: stepCounter,
          tool_name: tc.toolName,
          tool_input: JSON.stringify(tc.args),
          tool_output: tr ? JSON.stringify(tr.result) : undefined,
          reasoning: step.text || undefined,
        });
      }
      if (toolCalls.length === 0 && step.text) {
        await logAgentStep({
          diagnosis_id: diagnosisId,
          step_number: stepCounter,
          tool_name: "reasoning",
          reasoning: step.text,
        });
      }
    },
    onFinish: async () => {
      await teardownSandbox(sandbox);
    },
  });

  return result;
}
