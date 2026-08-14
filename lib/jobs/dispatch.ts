import { requiredEnv } from "@/lib/env";
import { signPayload } from "@/lib/jobs/signatures";

export async function dispatchJob(jobId: string, action: "inspect" | "process") {
  const body = JSON.stringify({ jobId, action });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signPayload(requiredEnv("JOB_DISPATCH_SECRET"), timestamp, body);
  const response = await fetch(requiredEnv("CLOUDFLARE_ORCHESTRATOR_URL"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-paperclean-timestamp": timestamp,
      "x-paperclean-signature": signature,
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Job dispatch failed with ${response.status}`);
}
