const VERCEL_DEPLOY_URL = 'https://api.vercel.com/v13/deployments';

export type DeployResponse = {
  id: string;
  url: string;
  state: string;
};

export async function triggerVercelDeploy({
  projectId,
  token,
  payload
}: {
  projectId: string;
  token: string;
  payload: Record<string, unknown>;
}): Promise<DeployResponse> {
  const res = await fetch(`${VERCEL_DEPLOY_URL}?projectId=${projectId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Failed to trigger Vercel deploy: ${await res.text()}`);
  }

  return res.json();
}
