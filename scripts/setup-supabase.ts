/**
 * Creates the required Supabase tables and storage bucket.
 * Usage: npx tsx scripts/setup-supabase.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://swkfyibvnzgrqrbcbtny.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function main() {
  if (!SUPABASE_KEY) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY is required");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("\n📦 Setting up Supabase tables and storage...\n");

  // Create diagnoses table
  const { error: e1 } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS diagnoses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        screenshot_url text,
        dom_snapshot text,
        voice_transcript text,
        gemini_analysis jsonb,
        page_url text,
        viewport jsonb,
        status text DEFAULT 'pending',
        created_at timestamptz DEFAULT now()
      );
    `,
  });

  if (e1) {
    // Try alternative: just insert a dummy row to see if table exists
    console.log("   ⚠ RPC not available, trying direct table check...");

    // Check if table exists by querying it
    const { error: checkErr } = await supabase.from("diagnoses").select("id").limit(1);
    if (checkErr && checkErr.message.includes("not found")) {
      console.error("   ❌ Table 'diagnoses' doesn't exist. Please create it manually in Supabase SQL editor:");
      console.log(`
      CREATE TABLE diagnoses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        screenshot_url text,
        dom_snapshot text,
        voice_transcript text,
        gemini_analysis jsonb,
        page_url text,
        viewport jsonb,
        status text DEFAULT 'pending',
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE fixes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        diagnosis_id uuid REFERENCES diagnoses(id),
        files_changed jsonb,
        commit_sha text,
        deploy_url text,
        agent_reasoning text,
        status text DEFAULT 'pending',
        created_at timestamptz DEFAULT now()
      );
      `);
      process.exit(1);
    } else {
      console.log("   ✅ Table 'diagnoses' already exists");
    }

    const { error: checkErr2 } = await supabase.from("fixes").select("id").limit(1);
    if (checkErr2 && checkErr2.message.includes("not found")) {
      console.error("   ❌ Table 'fixes' doesn't exist. See SQL above.");
      process.exit(1);
    } else {
      console.log("   ✅ Table 'fixes' already exists");
    }
  } else {
    console.log("   ✅ diagnoses table created");

    const { error: e2 } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS fixes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          diagnosis_id uuid REFERENCES diagnoses(id),
          files_changed jsonb,
          commit_sha text,
          deploy_url text,
          agent_reasoning text,
          status text DEFAULT 'pending',
          created_at timestamptz DEFAULT now()
        );
      `,
    });
    if (e2) console.error("   ❌ fixes table:", e2.message);
    else console.log("   ✅ fixes table created");
  }

  // Create storage bucket
  const { error: bucketErr } = await supabase.storage.createBucket("diagnosis-assets", {
    public: true,
  });
  if (bucketErr) {
    if (bucketErr.message.includes("already exists")) {
      console.log("   ✅ Storage bucket 'diagnosis-assets' already exists");
    } else {
      console.error("   ❌ Storage bucket error:", bucketErr.message);
    }
  } else {
    console.log("   ✅ Storage bucket 'diagnosis-assets' created");
  }

  console.log("\n✅ Setup complete!\n");
}

main().catch((err) => {
  console.error("❌ Setup failed:", err);
  process.exit(1);
});
