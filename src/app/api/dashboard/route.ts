import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const diagnosisId = req.nextUrl.searchParams.get("id");
  const sb = getSupabase();

  if (!sb) {
    return NextResponse.json({ diagnoses: [], steps: [], fix: null });
  }

  // Fetch recent diagnoses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: diagnoses } = await (sb.from("diagnoses") as any)
    .select("id, status, page_url, gemini_analysis, screenshot_url, voice_transcript, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  let steps = null;
  let fix = null;

  if (diagnosisId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: s } = await (sb.from("agent_steps") as any)
      .select("*")
      .eq("diagnosis_id", diagnosisId)
      .order("step_number", { ascending: true });
    steps = s;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: f } = await (sb.from("fixes") as any)
      .select("*")
      .eq("diagnosis_id", diagnosisId)
      .order("created_at", { ascending: false })
      .limit(1);
    fix = f?.[0] || null;
  }

  return NextResponse.json({ diagnoses: diagnoses ?? [], steps: steps ?? [], fix });
}
