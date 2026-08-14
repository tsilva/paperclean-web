import { z } from "zod";

import { accountForUser, requireUserId, routeError } from "@/lib/auth";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { featureFlags } from "@/lib/env";
import { dispatchJob } from "@/lib/jobs/dispatch";
import { createInspectionJob, hasActiveJob, listJobs } from "@/lib/jobs/service";
import { eq } from "drizzle-orm";

const requestSchema = z.object({
  objectKey: z.string().min(10).max(500),
  fileName: z.string().trim().min(1).max(240),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  bytes: z.number().int().positive().max(100 * 1024 * 1024),
});

export async function GET() {
  try {
    const account = await accountForUser(await requireUserId());
    return Response.json({ jobs: await listJobs(account.id) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!featureFlags.dispatch) throw new Error("Job processing is not configured");
    const input = requestSchema.parse(await request.json());
    const account = await accountForUser(await requireUserId());
    if (await hasActiveJob(account.id)) {
      return Response.json({ error: "Finish your active job before starting another" }, { status: 409 });
    }
    const job = await createInspectionJob({ accountId: account.id, ...input });
    try {
      await dispatchJob(job.id, "inspect");
    } catch (error) {
      await db()
        .update(jobs)
        .set({ status: "failed", failureCode: "dispatch_failed", completedAt: new Date() })
        .where(eq(jobs.id, job.id));
      throw error;
    }
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid job request" }, { status: 400 });
    }
    return routeError(error);
  }
}
