import { NextRequest } from 'next/server';
import { Buffer } from 'node:buffer';
import { streamObject } from 'ai';
import { z } from 'zod';
import { bugReportSchema } from '@/lib/schemas';
import { getServiceClient } from '@/lib/supabase';
import { multimodalReasoningModel } from '@/lib/gemini';

const payloadSchema = z.object({
  screenshotBase64: z.string(),
  domSnapshot: z.string(),
  audioBase64: z.string().optional(),
  audioMimeType: z.string().default('audio/webm'),
  voiceSummary: z.string().optional(),
  clerkUserId: z.string().optional()
});

async function persistAsset({
  bucket,
  path,
  data,
  contentType
}: {
  bucket: string;
  path: string;
  data: Uint8Array;
  contentType: string;
}) {
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(bucket).upload(path, data, {
    contentType,
    upsert: true
  });

  if (error) {
    throw new Error(error.message);
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return publicUrl;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { screenshotBase64, domSnapshot, audioBase64, audioMimeType, voiceSummary, clerkUserId } =
    payloadSchema.parse(body);

  const screenshotBuffer = Buffer.from(screenshotBase64, 'base64');
  const audioBuffer = audioBase64 ? Buffer.from(audioBase64, 'base64') : undefined;

  const supabase = getServiceClient();
  const inserted = await supabase
    .from('debug_sessions')
    .insert({
      dom_snapshot: domSnapshot,
      clerk_user_id: clerkUserId ?? null,
      voice_summary: voiceSummary ?? null
    })
    .select('id')
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? 'Unable to create session row');
  }

  const baseId = inserted.data.id;
  const screenshotUrl = await persistAsset({
    bucket: 'debug-assets',
    path: `screenshots/${baseId}.png`,
    data: new Uint8Array(screenshotBuffer),
    contentType: 'image/png'
  });

  let audioUrl: string | null = null;

  if (audioBuffer) {
    audioUrl = await persistAsset({
      bucket: 'debug-assets',
      path: `audio/${baseId}.webm`,
      data: new Uint8Array(audioBuffer),
      contentType: audioMimeType
    });
  }

  const userContent = [
    {
      type: 'input_text' as const,
      text: `DOM Snapshot:\n${domSnapshot.slice(0, 15000)}`
    },
    {
      type: 'input_image' as const,
      image: screenshotBuffer,
      mimeType: 'image/png'
    },
    voiceSummary
      ? ({
          type: 'input_text' as const,
          text: `Voice notes summary:\n${voiceSummary}`
        } as const)
      : undefined,
    audioBuffer
      ? ({
          type: 'input_audio' as const,
          audio: audioBuffer,
          mimeType: audioMimeType
        } as const)
      : undefined
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const result = await streamObject({
    model: multimodalReasoningModel(),
    schema: bugReportSchema,
    messages: [
      {
        role: 'system',
        content:
          'You are a debugging agent. You are given a screenshot, DOM, and voice context. Identify the bug, explain the root cause from the DOM, and output a JSON object with bugDescription, affectedComponent, rootCause, suggestedDiff, severity, and confidence.'
      },
      {
        role: 'user',
        content: userContent
      }
    ],
    onFinal: async ({ object }) => {
      await supabase
        .from('debug_sessions')
        .update({
          screenshot_url: screenshotUrl,
          audio_url: audioUrl,
          bug_description: object?.bugDescription,
          affected_component: object?.affectedComponent,
          root_cause: object?.rootCause,
          suggested_diff: object?.suggestedDiff,
          severity: object?.severity,
          confidence: object?.confidence
        })
        .eq('id', baseId);
    }
  });

  return result.toTextStreamResponse({
    headers: {
      'x-session-id': baseId
    }
  });
}
