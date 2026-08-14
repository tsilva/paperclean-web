import { Container, getContainer } from "@cloudflare/containers";

type JobAction = "inspect" | "process";
type JobMessage = { jobId: string; action: JobAction };
type WorkItem = {
  id: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  pageTotal: number | null;
  action: JobAction;
};

interface Env {
  PAPERCLEAN_QUEUE: Queue<JobMessage>;
  PAPERCLEAN_BUCKET: R2Bucket;
  PAPERCLEAN_CONTAINER: DurableObjectNamespace<PaperCleanContainer>;
  CALLBACK_BASE_URL: string;
  PROCESSOR_VERSION: string;
  JOB_DISPATCH_SECRET: string;
  JOB_CALLBACK_SECRET: string;
  OPENROUTER_API_KEY: string;
}

export class PaperCleanContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "2m";
}

function asHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signature(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return asHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)));
}

async function validSignature(request: Request, secret: string, body: string): Promise<boolean> {
  const timestamp = request.headers.get("x-paperclean-timestamp") || "";
  const received = request.headers.get("x-paperclean-signature") || "";
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() - seconds * 1000) > 5 * 60_000) return false;
  return received === (await signature(secret, timestamp, body));
}

async function signedPost(url: string, secret: string, payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-paperclean-timestamp": timestamp,
      "x-paperclean-signature": await signature(secret, timestamp, body),
    },
    body,
  });
}

async function sendEvent(env: Env, jobId: string, payload: Record<string, unknown>): Promise<void> {
  const response = await signedPost(
    `${env.CALLBACK_BASE_URL}/api/internal/jobs/${jobId}/events`,
    env.JOB_CALLBACK_SECRET,
    payload,
  );
  if (!response.ok) throw new Error(`Callback failed with ${response.status}`);
}

async function workItem(env: Env, message: JobMessage): Promise<WorkItem> {
  const response = await signedPost(
    `${env.CALLBACK_BASE_URL}/api/internal/jobs/${message.jobId}/work`,
    env.JOB_CALLBACK_SECRET,
    { action: message.action },
  );
  if (!response.ok) throw new Error(`Work lookup failed with ${response.status}`);
  return response.json<WorkItem>();
}

async function processMessage(env: Env, message: JobMessage): Promise<void> {
  const work = await workItem(env, message);
  const source = await env.PAPERCLEAN_BUCKET.get(work.objectKey);
  if (!source?.body) throw new Error("Source object is missing");
  const container = getContainer(env.PAPERCLEAN_CONTAINER, work.id);
  const response = await container.fetch(
    new Request(`http://container/${message.action}`, {
      method: "POST",
      headers: {
        "content-type": work.contentType,
        "x-paperclean-job-id": work.id,
        "x-paperclean-file-name": encodeURIComponent(work.fileName),
        "x-paperclean-callback-url": `${env.CALLBACK_BASE_URL}/api/internal/jobs/${work.id}/events`,
        "x-paperclean-callback-secret": env.JOB_CALLBACK_SECRET,
        "x-openrouter-api-key": env.OPENROUTER_API_KEY,
      },
      body: source.body,
    }),
  );
  if (!response.ok) throw new Error(`Processor failed with ${response.status}: ${await response.text()}`);

  if (message.action === "inspect") {
    const inspection = await response.json<{ pageTotal: number; estimatedMaxChargeCents: number; processorVersion: string }>();
    await sendEvent(env, work.id, {
      eventId: `${work.id}:inspection`,
      type: "inspection.completed",
      ...inspection,
    });
    return;
  }

  const extension = response.headers.get("x-paperclean-extension") || "bin";
  const outputKey = work.objectKey.replace(/\/uploads\/[^/]+$/, `/results/${work.id}.clean.${extension}`);
  await env.PAPERCLEAN_BUCKET.put(outputKey, response.body, {
    httpMetadata: { contentType: response.headers.get("content-type") || "application/octet-stream" },
    customMetadata: { jobId: work.id, retention: "seven-days" },
  });
  await sendEvent(env, work.id, {
    eventId: `${work.id}:complete`,
    type: "job.completed",
    outputKey,
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method !== "POST") return new Response("Not found", { status: 404 });
    const body = await request.text();
    if (!(await validSignature(request, env.JOB_DISPATCH_SECRET, body))) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
    let message: JobMessage;
    try {
      message = JSON.parse(body) as JobMessage;
      if (!message.jobId || !["inspect", "process"].includes(message.action)) throw new Error();
    } catch {
      return Response.json({ error: "Invalid job message" }, { status: 400 });
    }
    await env.PAPERCLEAN_QUEUE.send(message);
    return Response.json({ queued: true }, { status: 202 });
  },

  async queue(batch, env): Promise<void> {
    for (const item of batch.messages) {
      try {
        await processMessage(env, item.body);
        item.ack();
      } catch (error) {
        console.error(error);
        if (item.attempts < 3) {
          item.retry({ delaySeconds: Math.min(300, 20 ** item.attempts) });
          continue;
        }
        await sendEvent(env, item.body.jobId, {
          eventId: `${item.body.jobId}:failed`,
          type: "job.failed",
          code: "processor_failed",
          message: "PaperClean could not finish this job safely. No wallet charge was made.",
        });
        item.ack();
      }
    }
  },
} satisfies ExportedHandler<Env, JobMessage>;
