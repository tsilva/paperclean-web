import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { featureFlags, requiredEnv } from "@/lib/env";
import { verifyPayloadSignature } from "@/lib/jobs/signatures";

const requestSchema = z.object({ action: z.enum(["inspect", "process"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.text();
  const timestamp = request.headers.get("x-paperclean-timestamp") || "";
  const signature = request.headers.get("x-paperclean-signature") || "";
  if (!verifyPayloadSignature(requiredEnv("JOB_CALLBACK_SECRET"), timestamp, body, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const { action } = requestSchema.parse(JSON.parse(body));
    if (action === "process" && !featureFlags.conversion) {
      return Response.json(
        { error: "Document conversion is temporarily unavailable" },
        { status: 503 },
      );
    }
    const [job] = await db().select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    const allowed = action === "inspect" ? job.status === "inspecting" : job.status === "queued";
    if (!allowed) return Response.json({ error: "Job is not in the requested state" }, { status: 409 });
    return Response.json({
      id: job.id,
      objectKey: job.objectKey,
      fileName: job.fileName,
      contentType: job.contentType,
      pageTotal: job.pageTotal,
      action,
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json({ error: "Invalid work request" }, { status: 400 });
    }
    console.error(error);
    return Response.json({ error: "Could not read work item" }, { status: 500 });
  }
}
