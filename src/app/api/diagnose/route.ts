import { NextRequest, NextResponse } from "next/server";
import { DiagnosisInputSchema } from "@/lib/schemas";
import {
  createDiagnosis,
  uploadScreenshot,
  updateDiagnosisStatus,
  updateDiagnosisIssue,
} from "@/lib/supabase";
import { createGitHubIssue } from "@/lib/github";
import { runAgent } from "@/lib/agent";

export async function POST(req: NextRequest) {
  // Validate API key
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.DIAGNOSE_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = DiagnosisInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid diagnosis payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const diagnosis = parsed.data;

    // Upload screenshot to Supabase Storage
    const screenshotUrl = await uploadScreenshot(
      crypto.randomUUID(),
      diagnosis.screenshot
    );

    // Store diagnosis in Supabase
    const diagnosisId = await createDiagnosis(
      "extension-user",
      diagnosis,
      screenshotUrl
    );

    // Create GitHub issue with screenshot + diagnosis details
    try {
      const issueNumber = await createGitHubIssue({
        diagnosisId,
        analysis: diagnosis.gemini_analysis,
        pageUrl: diagnosis.page_url,
        voiceTranscript: diagnosis.voice_transcript,
        screenshotUrl,
      });
      await updateDiagnosisIssue(diagnosisId, issueNumber);
      console.log(`[Diagnose] GitHub issue #${issueNumber} created`);
    } catch (issueErr) {
      console.error("[Diagnose] Failed to create GitHub issue:", issueErr);
    }

    // Fire-and-forget: run the agent in the background
    try {
      await runAgent(diagnosisId);
    } catch (agentErr) {
      console.error("[Diagnose] Agent failed:", agentErr);
      await updateDiagnosisStatus(diagnosisId, "failed").catch(() => {});
      return NextResponse.json(
        {
          diagnosisId,
          status: "failed",
          error:
            agentErr instanceof Error
              ? agentErr.message
              : "Unknown agent error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      diagnosisId,
      status: "pending",
      message: "Diagnosis received. Agent is working on a fix.",
    });
  } catch (err) {
    console.error("[Diagnose] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
