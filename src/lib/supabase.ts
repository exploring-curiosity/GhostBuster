import { createClient } from "@supabase/supabase-js";
import type {
  DiagnosisInput,
  DiagnosisStatus,
  DiagnosisRow,
  FixRow,
  FileChange,
} from "./schemas";

let _supabase: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return null;
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export async function createDiagnosis(
  userId: string,
  data: DiagnosisInput,
  screenshotUrl: string | null
): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (sb.from("diagnoses") as any)
    .insert({
      user_id: userId,
      screenshot_url: screenshotUrl,
      dom_snapshot: data.dom_snapshot,
      voice_transcript: data.voice_transcript,
      gemini_analysis: data.gemini_analysis,
      page_url: data.page_url,
      viewport: data.viewport,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create diagnosis: ${error.message}`);
  return (row as { id: string }).id;
}

export async function updateDiagnosisStatus(
  id: string,
  status: DiagnosisStatus
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("diagnoses") as any)
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(`Failed to update diagnosis status: ${error.message}`);
}

export async function updateDiagnosisIssue(
  id: string,
  issueNumber: number
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("diagnoses") as any)
    .update({ github_issue_number: issueNumber })
    .eq("id", id);
  if (error) console.error("Failed to store issue number:", error.message);
}

export async function getDiagnosis(id: string): Promise<DiagnosisRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("diagnoses") as any)
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as DiagnosisRow;
}

export async function getRecentDiagnoses(limit = 20): Promise<DiagnosisRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("diagnoses") as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to fetch diagnoses: ${error.message}`);
  return (data ?? []) as DiagnosisRow[];
}

export async function createFix(params: {
  diagnosis_id: string;
  files_changed: FileChange[];
  agent_reasoning: string;
}): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("fixes") as any)
    .insert({
      diagnosis_id: params.diagnosis_id,
      files_changed: params.files_changed,
      agent_reasoning: params.agent_reasoning,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create fix: ${error.message}`);
  return (data as { id: string }).id;
}

export async function updateFix(
  id: string,
  updates: Partial<Pick<FixRow, "status" | "commit_sha" | "deploy_url">>
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("fixes") as any).update(updates).eq("id", id);
  if (error) throw new Error(`Failed to update fix: ${error.message}`);
}

export async function getFixByDiagnosisId(diagnosisId: string): Promise<FixRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("fixes") as any)
    .select("*")
    .eq("diagnosis_id", diagnosisId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as FixRow;
}

export async function logAgentStep(params: {
  diagnosis_id: string;
  step_number: number;
  tool_name?: string;
  tool_input?: string;
  tool_output?: string;
  reasoning?: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("agent_steps") as any).insert({
    diagnosis_id: params.diagnosis_id,
    step_number: params.step_number,
    tool_name: params.tool_name || null,
    tool_input: params.tool_input?.slice(0, 5000) || null,
    tool_output: params.tool_output?.slice(0, 5000) || null,
    reasoning: params.reasoning || null,
  });
  if (error) console.error("[AgentStep] Failed to log:", error.message);
}

export async function uploadScreenshot(
  diagnosisId: string,
  base64Data: string
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const filePath = `screenshots/${diagnosisId}.png`;
    const { error } = await sb.storage
      .from("diagnosis-assets")
      .upload(filePath, buffer, { contentType: "image/png", upsert: true });
    if (error) {
      console.error("Screenshot upload failed:", error.message);
      return null;
    }
    const { data: urlData } = sb.storage
      .from("diagnosis-assets")
      .getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (err) {
    console.error("Screenshot upload error:", err);
    return null;
  }
}
