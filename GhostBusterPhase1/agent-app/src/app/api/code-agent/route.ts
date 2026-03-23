import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase';
import { codeModel } from '@/lib/gemini';
import { triggerVercelDeploy } from '@/lib/vercel';

const requestSchema = z.object({
  sessionId: z.string(),
  stopWhen: z.number().min(1).max(8).default(4),
  deployment: z
    .object({
      projectId: z.string().optional(),
      token: z.string().optional()
    })
    .optional()
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, stopWhen, deployment } = requestSchema.parse(body);
  const supabase = getServiceClient();
  const projectId = deployment?.projectId ?? process.env.VERCEL_PROJECT_ID;
  const token = deployment?.token ?? process.env.VERCEL_DEPLOY_TOKEN;

  if (!projectId || !token) {
    throw new Error('Missing VERCEL_PROJECT_ID or VERCEL_DEPLOY_TOKEN');
  }

  const { data: session, error: sessionError } = await supabase
    .from('debug_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? 'Session not found');
  }

  const toolContext = {
    async readFile(path: string) {
      const { data, error } = await supabase
        .from('app_files')
        .select('content')
        .eq('file_path', path)
        .single();
      if (error) {
        throw new Error(error.message);
      }
      return data?.content ?? '';
    },
    async writeFile(path: string, content: string) {
      const { error } = await supabase
        .from('app_files')
        .upsert({ file_path: path, content });
      if (error) {
        throw new Error(error.message);
      }
      return 'ok';
    },
    async listFiles() {
      const { data, error } = await supabase.from('app_files').select('file_path');
      if (error) {
        throw new Error(error.message);
      }
      return data?.map((row) => row.file_path) ?? [];
    }
  };

  const result = await streamText({
    model: codeModel(),
    system:
      'You are GhostBuster code agent. Use read_file, write_file, list_files, and deploy tools to fix the bug. Always explain what you changed before deploying.',
    messages: [
      {
        role: 'user',
        content: `Bug description: ${session.bug_description}\nRoot cause: ${session.root_cause}\nSuggested diff: ${session.suggested_diff}`
      }
    ],
    tools: {
      read_file: {
        description: 'Load the latest source code for a path from Supabase.',
        parameters: z.object({ path: z.string() }),
        execute: async ({ path }) => ({
          path,
          content: await toolContext.readFile(path)
        })
      },
      write_file: {
        description: 'Write new file contents back to Supabase.',
        parameters: z.object({ path: z.string(), content: z.string() }),
        execute: async ({ path, content }) => ({
          path,
          status: await toolContext.writeFile(path, content)
        })
      },
      list_files: {
        description: 'List the project structure.',
        parameters: z.object({}),
        execute: async () => ({ files: await toolContext.listFiles() })
      },
      deploy: {
        description: 'Trigger a Vercel deployment after files are updated.',
        parameters: z.object({
          message: z.string().optional()
        }),
        execute: async ({ message }) => {
          const deployResponse = await triggerVercelDeploy({
            projectId,
            token,
            payload: {
              source: 'ghostbuster-agent',
              target: 'production',
              meta: { sessionId, message }
            }
          });
          return deployResponse;
        }
      }
    },
    maxToolRoundtrips: stopWhen,
    onFinal: async ({ text, toolCalls }) => {
      await supabase
        .from('debug_sessions')
        .update({
          fix_summary: text,
          last_tool_calls: JSON.stringify(toolCalls ?? [])
        })
        .eq('id', sessionId);
    }
  });

  return result.toAIStreamResponse();
}
