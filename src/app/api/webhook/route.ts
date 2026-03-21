import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import crypto from "crypto";

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac("sha1", secret);
  hmac.update(body);
  const expected = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secret = process.env.VERCEL_WEBHOOK_SECRET;

    // Verify webhook signature if secret is configured
    if (secret) {
      const signature = req.headers.get("x-vercel-signature");
      if (!verifySignature(rawBody, signature, secret)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const { type, payload: deployPayload } = payload;

    // We care about deployment ready/error events
    if (type === "deployment.ready" || type === "deployment.error") {
      const deploymentUrl = deployPayload?.deployment?.url;
      const commitSha =
        deployPayload?.deployment?.meta?.githubCommitSha ||
        deployPayload?.deployment?.meta?.commitSha;
      const status = type === "deployment.ready" ? "success" : "failed";

      if (commitSha) {
        // Find the fix record by commit SHA and update it
        const db = getSupabase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: fix } = await (db.from("fixes") as any)
          .select("id, diagnosis_id")
          .eq("commit_sha", commitSha)
          .single();

        if (fix) {
          const f = fix as { id: string; diagnosis_id: string };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db.from("fixes") as any)
            .update({
              status,
              deploy_url: deploymentUrl ? `https://${deploymentUrl}` : null,
            })
            .eq("id", f.id);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db.from("diagnoses") as any)
            .update({
              status: status === "success" ? "deployed" : "failed",
            })
            .eq("id", f.diagnosis_id);

          console.log(`[Webhook] Updated fix ${f.id} → ${status}`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
