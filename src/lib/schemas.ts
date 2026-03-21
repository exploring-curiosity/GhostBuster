import { z } from "zod";

export const GeminiAnalysisSchema = z.object({
  bug_description: z.string(),
  affected_component: z.string(),
  root_cause: z.string(),
  suggested_fix: z.string(),
});

export const ViewportSchema = z.object({
  width: z.number(),
  height: z.number(),
});

export const DiagnosisInputSchema = z.object({
  screenshot: z.string(),
  dom_snapshot: z.string(),
  voice_transcript: z.string(),
  gemini_analysis: GeminiAnalysisSchema,
  page_url: z.string(),
  viewport: ViewportSchema,
  timestamp: z.string(),
});

export type DiagnosisInput = z.infer<typeof DiagnosisInputSchema>;
export type GeminiAnalysis = z.infer<typeof GeminiAnalysisSchema>;

export const FileChangeSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export type FileChange = z.infer<typeof FileChangeSchema>;

export const DiagnosisStatusSchema = z.enum([
  "pending",
  "fixing",
  "deploying",
  "deployed",
  "failed",
]);

export type DiagnosisStatus = z.infer<typeof DiagnosisStatusSchema>;

export interface DiagnosisRow {
  id: string;
  user_id: string;
  screenshot_url: string | null;
  dom_snapshot: string;
  voice_transcript: string;
  gemini_analysis: GeminiAnalysis;
  page_url: string;
  viewport: { width: number; height: number };
  status: DiagnosisStatus;
  github_issue_number: number | null;
  auto_deploy: boolean;
  created_at: string;
}

export interface FixRow {
  id: string;
  diagnosis_id: string;
  files_changed: FileChange[];
  commit_sha: string | null;
  deploy_url: string | null;
  agent_reasoning: string;
  status: "pending" | "success" | "failed";
  created_at: string;
}
