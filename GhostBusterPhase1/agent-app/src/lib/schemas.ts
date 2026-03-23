import { z } from 'zod';

export const bugReportSchema = z.object({
  bugDescription: z.string().describe('Human readable summary of the visual issue.'),
  affectedComponent: z.string().describe('The component or DOM node that needs a fix.'),
  rootCause: z.string().describe('Why the bug occurs based on DOM/CSS/JS context.'),
  suggestedDiff: z
    .string()
    .describe('Unified diff or pseudo diff that describes the change needed to fix the bug.'),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  confidence: z.number().min(0).max(1).default(0.6)
});

export type BugReport = z.infer<typeof bugReportSchema>;

export const codeAgentTaskSchema = z.object({
  componentPath: z.string(),
  instructions: z.string(),
  diff: z.string()
});

export type CodeAgentTask = z.infer<typeof codeAgentTaskSchema>;
