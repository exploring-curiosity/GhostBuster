import { NextRequest, NextResponse } from "next/server";
import { runAgentStream } from "@/lib/agent";
import { getDiagnosis } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { diagnosisId } = await req.json();

    if (!diagnosisId || typeof diagnosisId !== "string") {
      return NextResponse.json(
        { error: "diagnosisId is required" },
        { status: 400 }
      );
    }

    const diagnosis = await getDiagnosis(diagnosisId);
    if (!diagnosis) {
      return NextResponse.json(
        { error: "Diagnosis not found" },
        { status: 404 }
      );
    }

    const result = await runAgentStream(diagnosisId);

    return result.toDataStreamResponse();
  } catch (err) {
    console.error("[Agent Stream] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
