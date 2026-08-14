import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, jobs, uploadedObjects } from "@/lib/db/schema";

export async function listJobs(accountId: string) {
  return db()
    .select()
    .from(jobs)
    .where(eq(jobs.accountId, accountId))
    .orderBy(desc(jobs.createdAt))
    .limit(50);
}

export async function jobForAccount(jobId: string, accountId: string) {
  const [job] = await db()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.accountId, accountId)))
    .limit(1);
  return job ?? null;
}

export async function createInspectionJob(input: {
  accountId: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  bytes: number;
}) {
  const database = db();
  const [upload] = await database
    .select()
    .from(uploadedObjects)
    .where(
      and(
        eq(uploadedObjects.objectKey, input.objectKey),
        eq(uploadedObjects.accountId, input.accountId),
      ),
    )
    .limit(1);
  if (!upload?.verifiedAt) throw new Error("Upload has not been verified");
  const [job] = await database
    .insert(jobs)
    .values({
      accountId: input.accountId,
      objectKey: input.objectKey,
      fileName: input.fileName,
      contentType: input.contentType,
      sourceBytes: input.bytes,
    })
    .returning();
  return job;
}

export async function confirmJob(jobId: string, accountId: string) {
  return db().transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.accountId, accountId)))
      .limit(1);
    if (!job || job.status !== "awaiting_confirmation" || !job.estimatedMaxChargeCents) {
      throw new Error("Job is not ready for confirmation");
    }
    const amount = job.estimatedMaxChargeCents;
    const [account] = await tx
      .update(accounts)
      .set({
        reservedBalanceCents: sql`${accounts.reservedBalanceCents} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accounts.id, accountId),
          sql`${accounts.walletBalanceCents} - ${accounts.reservedBalanceCents} >= ${amount}`,
        ),
      )
      .returning();
    if (!account) throw new Error("Insufficient wallet credit");
    const [confirmed] = await tx
      .update(jobs)
      .set({ status: "queued", reservedCents: amount, updatedAt: new Date() })
      .where(and(eq(jobs.id, jobId), eq(jobs.status, "awaiting_confirmation")))
      .returning();
    if (!confirmed) throw new Error("Job state changed; refresh and try again");
    return confirmed;
  });
}

export const activeStatuses = [
  "inspecting",
  "awaiting_confirmation",
  "queued",
  "running",
] as const;

export async function hasActiveJob(accountId: string) {
  const [active] = await db()
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.accountId, accountId), inArray(jobs.status, [...activeStatuses])))
    .limit(1);
  return Boolean(active);
}
