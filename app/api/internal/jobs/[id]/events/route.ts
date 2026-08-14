import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  accounts,
  jobEvents,
  jobPages,
  jobs,
  walletCreditLots,
  walletTransactions,
} from "@/lib/db/schema";
import { requiredEnv } from "@/lib/env";
import { verifyPayloadSignature } from "@/lib/jobs/signatures";
import { finalJobChargeCents, providerMicrosToChargeCents } from "@/lib/payments/pricing";

const pageResultStatus = z.enum([
  "model_generated_clean",
  "model_assisted_clean",
  "source_preserving_clean",
  "original_fallback",
  "failed",
]);

const eventSchema = z.discriminatedUnion("type", [
  z.object({
    eventId: z.string().min(8).max(200),
    type: z.literal("inspection.completed"),
    pageTotal: z.number().int().min(1).max(100),
    estimatedMaxChargeCents: z.number().int().min(30).max(100_000),
    processorVersion: z.string().min(1).max(100),
  }),
  z.object({ eventId: z.string().min(8).max(200), type: z.literal("job.started") }),
  z.object({
    eventId: z.string().min(8).max(200),
    type: z.literal("page.completed"),
    pageNumber: z.number().int().min(1).max(100),
    status: pageResultStatus,
    attempts: z.number().int().min(0).max(3),
    providerCostMicros: z.number().int().min(0).max(1_000_000_000),
    fallbackReason: z.string().max(500).nullable().optional(),
  }),
  z.object({
    eventId: z.string().min(8).max(200),
    type: z.literal("job.completed"),
    outputKey: z.string().min(10).max(500),
  }),
  z.object({
    eventId: z.string().min(8).max(200),
    type: z.literal("job.failed"),
    code: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
  }),
]);

async function consumeCreditLots(
  tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0],
  accountId: string,
  amountCents: number,
) {
  let remaining = amountCents;
  const lots = await tx
    .select()
    .from(walletCreditLots)
    .where(and(eq(walletCreditLots.accountId, accountId), eq(walletCreditLots.isDisputed, false)))
    .orderBy(asc(walletCreditLots.createdAt));
  for (const lot of lots) {
    if (remaining <= 0) break;
    const used = Math.min(remaining, lot.remainingAmountCents);
    if (used <= 0) continue;
    await tx
      .update(walletCreditLots)
      .set({ remainingAmountCents: lot.remainingAmountCents - used })
      .where(eq(walletCreditLots.id, lot.id));
    remaining -= used;
  }
  if (remaining > 0) throw new Error("Wallet credit lots did not cover the charge");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.text();
  const timestamp = request.headers.get("x-paperclean-timestamp") || "";
  const signature = request.headers.get("x-paperclean-signature") || "";
  if (!verifyPayloadSignature(requiredEnv("JOB_CALLBACK_SECRET"), timestamp, body, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const event = eventSchema.parse(JSON.parse(body));
    const applied = await db().transaction(async (tx) => {
      const [inserted] = await tx
        .insert(jobEvents)
        .values({ jobId: id, eventId: event.eventId, type: event.type, payload: event })
        .onConflictDoNothing()
        .returning();
      if (!inserted) return false;

      if (event.type === "inspection.completed") {
        await tx
          .update(jobs)
          .set({
            status: "awaiting_confirmation",
            pageTotal: event.pageTotal,
            estimatedMaxChargeCents: event.estimatedMaxChargeCents,
            processorVersion: event.processorVersion,
            updatedAt: new Date(),
          })
          .where(and(eq(jobs.id, id), eq(jobs.status, "inspecting")));
      } else if (event.type === "job.started") {
        await tx
          .update(jobs)
          .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(jobs.id, id), eq(jobs.status, "queued")));
      } else if (event.type === "page.completed") {
        const chargeable = !["original_fallback", "failed"].includes(event.status);
        await tx
          .insert(jobPages)
          .values({
            jobId: id,
            pageNumber: event.pageNumber,
            status: event.status,
            attempts: event.attempts,
            providerCostMicros: event.providerCostMicros,
            chargeCents: chargeable ? providerMicrosToChargeCents(event.providerCostMicros) : 0,
            fallbackReason: event.fallbackReason ?? null,
          })
          .onConflictDoUpdate({
            target: [jobPages.jobId, jobPages.pageNumber],
            set: {
              status: event.status,
              attempts: event.attempts,
              providerCostMicros: event.providerCostMicros,
              chargeCents: chargeable ? providerMicrosToChargeCents(event.providerCostMicros) : 0,
              fallbackReason: event.fallbackReason ?? null,
              updatedAt: new Date(),
            },
          });
      } else if (event.type === "job.completed") {
        const [job] = await tx.select().from(jobs).where(eq(jobs.id, id)).limit(1);
        if (!job || !["queued", "running"].includes(job.status)) throw new Error("Job is not active");
        const pages = await tx.select().from(jobPages).where(eq(jobPages.jobId, id));
        const cleanPages = pages.filter((page) =>
          ["model_generated_clean", "model_assisted_clean", "source_preserving_clean"].includes(
            page.status,
          ),
        );
        const fallbackPages = pages.filter((page) => page.status === "original_fallback");
        const providerMicros = cleanPages.reduce((sum, page) => sum + page.providerCostMicros, 0);
        const calculatedCharge = finalJobChargeCents(providerMicros);
        const charge = Math.min(calculatedCharge, job.reservedCents);
        const [account] = await tx
          .update(accounts)
          .set({
            walletBalanceCents: sql`${accounts.walletBalanceCents} - ${charge}`,
            reservedBalanceCents: sql`greatest(0, ${accounts.reservedBalanceCents} - ${job.reservedCents})`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, job.accountId))
          .returning();
        if (!account) throw new Error("Account not found");
        if (charge > 0) {
          await consumeCreditLots(tx, job.accountId, charge);
          await tx.insert(walletTransactions).values({
            accountId: job.accountId,
            jobId: job.id,
            type: "charge",
            amountCents: -charge,
            balanceAfterCents: account.walletBalanceCents,
            idempotencyKey: `job:${job.id}:final-charge`,
            description: `PaperClean job ${job.id}`,
          });
        }
        const completedAt = new Date();
        await tx
          .update(jobs)
          .set({
            status: fallbackPages.length > 0 ? "partial" : "succeeded",
            outputKey: event.outputKey,
            pagesSucceeded: cleanPages.length,
            pagesFallback: fallbackPages.length,
            chargedCents: charge,
            failureMessage:
              calculatedCharge > job.reservedCents ? "Charge capped at confirmed estimate" : null,
            completedAt,
            updatedAt: completedAt,
            purgeAfter: new Date(completedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
          })
          .where(eq(jobs.id, id));
      } else {
        const [job] = await tx.select().from(jobs).where(eq(jobs.id, id)).limit(1);
        if (job?.reservedCents) {
          await tx
            .update(accounts)
            .set({
              reservedBalanceCents: sql`greatest(0, ${accounts.reservedBalanceCents} - ${job.reservedCents})`,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, job.accountId));
        }
        await tx
          .update(jobs)
          .set({
            status: "failed",
            failureCode: event.code,
            failureMessage: event.message,
            completedAt: new Date(),
            updatedAt: new Date(),
            purgeAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          })
          .where(eq(jobs.id, id));
      }
      return true;
    });
    return Response.json({ ok: true, applied });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json({ error: "Invalid event payload" }, { status: 400 });
    }
    console.error(error);
    return Response.json({ error: "Could not apply job event" }, { status: 500 });
  }
}
