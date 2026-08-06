import { Sandbox } from "@vercel/sandbox";

export type { Sandbox } from "@vercel/sandbox";

const SANDBOX_TIMEOUT_MS = 5 * 60 * 1000;

export type SpawnSandboxResult =
  | { success: true; sandbox: Sandbox }
  | { success: false; error: string };

export async function spawnSandbox(
  repoUrl: string,
  githubToken?: string
): Promise<SpawnSandboxResult> {
  try {
    const sandbox = await createSandbox(repoUrl, githubToken);
    return { success: true, sandbox };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown sandbox spawn error";
    console.error("[Sandbox] Failed to spawn sandbox:", message);
    return { success: false, error: `Failed to spawn sandbox: ${message}` };
  }
}

export async function createSandbox(
  repoUrl: string,
  githubToken?: string
): Promise<Sandbox> {
  const cloneUrl = githubToken
    ? repoUrl.replace("https://", `https://${githubToken}@`)
    : repoUrl;

  const sandbox = await Sandbox.create({
    source: { url: cloneUrl, type: "git" },
    runtime: "node24",
    resources: { vcpus: 2 },
    timeout: SANDBOX_TIMEOUT_MS,
    teamId: process.env.VERCEL_TEAM_ID!,
    projectId: process.env.VERCEL_PROJECT_ID!,
    token: process.env.VERCEL_TOKEN!,
  });

  console.log("[Sandbox] Created, installing dependencies...");

  const installResult = await sandbox.runCommand("npm", ["install"]);
  if (installResult.exitCode !== 0) {
    const stderr = await installResult.stderr();
    console.warn("[Sandbox] npm install warnings:", stderr);
  }

  return sandbox;
}

export async function writeFileInSandbox(
  sandbox: Sandbox,
  path: string,
  content: string
): Promise<void> {
  const cleanPath = path.replace(/^\//, "");
  const dir = cleanPath.substring(0, cleanPath.lastIndexOf("/"));

  // Ensure directory exists
  if (dir) {
    await sandbox.runCommand("mkdir", ["-p", dir]);
  }

  // Write file via base64 piped through base64 -d to avoid escaping issues
  const b64 = Buffer.from(content, "utf-8").toString("base64");
  // Split into chunks if very large (shell arg limit ~128KB)
  const chunkSize = 60000;
  if (b64.length <= chunkSize) {
    const result = await sandbox.runCommand("sh", [
      "-c",
      `printf '%s' '${b64}' | base64 -d > '${cleanPath}'`,
    ]);
    if (result.exitCode !== 0) {
      const stderr = await result.stderr();
      throw new Error(`Failed to write ${cleanPath}: ${stderr}`);
    }
  } else {
    // For large files, write base64 to a temp file first, then decode
    const tmpPath = `/tmp/_ghostbuster_${Date.now()}.b64`;
    const chunks = b64.match(new RegExp(`.{1,${chunkSize}}`, "g")) || [];
    for (let i = 0; i < chunks.length; i++) {
      const op = i === 0 ? ">" : ">>";
      await sandbox.runCommand("sh", [
        "-c",
        `printf '%s' '${chunks[i]}' ${op} '${tmpPath}'`,
      ]);
    }
    const result = await sandbox.runCommand("sh", [
      "-c",
      `base64 -d '${tmpPath}' > '${cleanPath}' && rm -f '${tmpPath}'`,
    ]);
    if (result.exitCode !== 0) {
      const stderr = await result.stderr();
      throw new Error(`Failed to write ${cleanPath}: ${stderr}`);
    }
  }
}

export async function runCommandInSandbox(
  sandbox: Sandbox,
  command: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const result = await sandbox.runCommand("sh", ["-c", command]);
  return {
    exitCode: result.exitCode,
    stdout: await result.stdout(),
    stderr: await result.stderr(),
  };
}

export async function testBuild(
  sandbox: Sandbox
): Promise<{ success: boolean; output: string; errors: string }> {
  const result = await runCommandInSandbox(sandbox, "npm run build");
  return {
    success: result.exitCode === 0,
    output: result.stdout,
    errors: result.stderr,
  };
}

export async function teardownSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.stop();
  } catch (err) {
    console.error("Failed to teardown sandbox:", err);
  }
}
