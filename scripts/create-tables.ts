/**
 * Creates Supabase tables via direct PostgreSQL connection.
 * Usage: npx tsx scripts/create-tables.ts
 */

// @ts-ignore
import pg from "pg";
const { Client } = pg;

const pw = process.env.SUPABASE_DB_PASSWORD || "";
const ref = "swkfyibvnzgrqrbcbtny";

const CONFIGS = [
  { name: "Direct", host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
  { name: "Pooler tx", host: `aws-0-us-east-1.pooler.supabase.com`, port: 6543, user: `postgres.${ref}` },
  { name: "Pooler sess", host: `aws-0-us-east-1.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
];

const CREATE_SQL = `
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
`;

async function tryConnect(cfg: typeof CONFIGS[0]) {
  const client = new Client({
    host: cfg.host, port: cfg.port, user: cfg.user,
    password: pw, database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  return client;
}

async function main() {
  if (!pw) {
    console.error("❌ SUPABASE_DB_PASSWORD required"); process.exit(1);
  }

  console.log("\n📦 Trying Supabase DB connections...\n");

  for (const cfg of CONFIGS) {
    try {
      console.log(`   Trying ${cfg.name} (${cfg.host}:${cfg.port})...`);
      const client = await tryConnect(cfg);
      console.log(`   ✅ Connected via ${cfg.name}`);
      await client.query(CREATE_SQL);
      console.log("   ✅ diagnoses table ready");
      console.log("   ✅ fixes table ready");
      await client.end();
      console.log("\n✅ Tables created successfully!\n");
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ❌ ${cfg.name} failed: ${msg}`);
    }
  }

  console.error("\n❌ All connection methods failed.");
  console.error("   Please create tables manually in Supabase Dashboard → SQL Editor.");
  console.error("   SQL:\n" + CREATE_SQL);
  process.exit(1);
}

main();
