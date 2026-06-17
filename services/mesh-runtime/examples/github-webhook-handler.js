// Example: GitHub webhook handler that triggers workflows based on events.
// This would run as a separate service listening to GitHub webhook deliveries.

import crypto from 'crypto';

function verifyGitHubSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = 'sha256=' + hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function handleGitHubWebhook(req, meshRuntimeUrl) {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const payload = req.body;

  // Verify GitHub signature
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!verifyGitHubSignature(JSON.stringify(payload), signature, secret)) {
    throw new Error('Invalid GitHub signature');
  }

  // Route event to appropriate workflow
  let workflowId, triggerEvent;

  if (event === 'pull_request' && payload.action === 'opened') {
    workflowId = 'pr_review_pipeline';
    triggerEvent = {
      event: 'pull_request.opened',
      pr: {
        number: payload.pull_request.number,
        branch: payload.pull_request.head.ref,
        diff: payload.pull_request.diff_url,
        code: payload.pull_request.html_url,
      },
    };
  }

  if (!workflowId) {
    console.log(`Ignoring GitHub event: ${event} ${payload.action}`);
    return;
  }

  // POST to mesh runtime
  const response = await fetch(meshRuntimeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow_id: workflowId, trigger_event: triggerEvent }),
  });

  if (!response.ok) {
    throw new Error(`Mesh runtime error: ${response.status}`);
  }

  return await response.json();
}
