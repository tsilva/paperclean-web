import { and, eq, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import {
  accounts,
  stripeEvents,
  walletCreditLots,
  walletTransactions,
} from "@/lib/db/schema";
import { requiredEnv } from "@/lib/env";
import { stripe } from "@/lib/payments/stripe";

function resourceId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, requiredEnv("STRIPE_WEBHOOK_SECRET"));
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Invalid Stripe webhook" }, { status: 400 });
  }

  try {
    const processed = await db().transaction(async (tx) => {
      const [inserted] = await tx
        .insert(stripeEvents)
        .values({ id: event.id, type: event.type })
        .onConflictDoNothing()
        .returning();
      if (!inserted) return false;

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        if (session.payment_status !== "paid") return true;
        const accountId = session.metadata?.accountId;
        const amountCents = Number(session.metadata?.creditCents);
        if (!accountId || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
          throw new Error("Checkout metadata is invalid");
        }
        const [account] = await tx
          .update(accounts)
          .set({
            walletBalanceCents: sql`${accounts.walletBalanceCents} + ${amountCents}`,
            stripeCustomerId: resourceId(session.customer),
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, accountId))
          .returning();
        if (!account) throw new Error("Checkout account not found");
        await tx.insert(walletCreditLots).values({
          accountId,
          originalAmountCents: amountCents,
          remainingAmountCents: amountCents,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: resourceId(session.payment_intent),
        });
        await tx.insert(walletTransactions).values({
          accountId,
          type: "topup",
          amountCents,
          balanceAfterCents: account.walletBalanceCents,
          idempotencyKey: `stripe:${event.id}`,
          stripeEventId: event.id,
          description: "Stripe wallet top-up",
        });
      }

      if (event.type === "charge.refunded") {
        const charge = event.data.object;
        const paymentIntentId = resourceId(charge.payment_intent);
        if (!paymentIntentId) return true;
        const [lot] = await tx
          .select()
          .from(walletCreditLots)
          .where(eq(walletCreditLots.stripePaymentIntentId, paymentIntentId))
          .limit(1);
        if (!lot) return true;
        const refundDelta = Math.max(0, charge.amount_refunded - lot.refundedAmountCents);
        if (!refundDelta) return true;
        await tx
          .update(walletCreditLots)
          .set({
            refundedAmountCents: charge.amount_refunded,
            remainingAmountCents: sql`greatest(0, ${walletCreditLots.remainingAmountCents} - ${refundDelta})`,
          })
          .where(eq(walletCreditLots.id, lot.id));
        const [account] = await tx
          .update(accounts)
          .set({
            walletBalanceCents: sql`${accounts.walletBalanceCents} - ${refundDelta}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, lot.accountId))
          .returning();
        if (!account) throw new Error("Refund account not found");
        await tx.insert(walletTransactions).values({
          accountId: lot.accountId,
          type: "refund",
          amountCents: -refundDelta,
          balanceAfterCents: account.walletBalanceCents,
          idempotencyKey: `stripe:${event.id}`,
          stripeEventId: event.id,
          description: "Stripe wallet refund",
        });
      }

      if (event.type === "charge.dispute.created") {
        const dispute = event.data.object;
        const paymentIntentId = resourceId(dispute.payment_intent);
        if (!paymentIntentId) return true;
        const [lot] = await tx
          .select()
          .from(walletCreditLots)
          .where(eq(walletCreditLots.stripePaymentIntentId, paymentIntentId))
          .limit(1);
        if (!lot || lot.isDisputed) return true;
        await tx
          .update(walletCreditLots)
          .set({ isDisputed: true, remainingAmountCents: 0 })
          .where(eq(walletCreditLots.id, lot.id));
        const [account] = await tx
          .update(accounts)
          .set({
            walletBalanceCents: sql`${accounts.walletBalanceCents} - ${dispute.amount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, lot.accountId))
          .returning();
        if (!account) throw new Error("Dispute account not found");
        await tx.insert(walletTransactions).values({
          accountId: lot.accountId,
          type: "dispute",
          amountCents: -dispute.amount,
          balanceAfterCents: account.walletBalanceCents,
          idempotencyKey: `stripe:${event.id}`,
          stripeEventId: event.id,
          description: "Stripe payment dispute",
        });
      }

      if (event.type === "charge.dispute.closed" && event.data.object.status === "won") {
        const dispute = event.data.object;
        const paymentIntentId = resourceId(dispute.payment_intent);
        if (!paymentIntentId) return true;
        const [lot] = await tx
          .select()
          .from(walletCreditLots)
          .where(
            and(
              eq(walletCreditLots.stripePaymentIntentId, paymentIntentId),
              eq(walletCreditLots.isDisputed, true),
            ),
          )
          .limit(1);
        if (!lot) return true;
        await tx
          .update(walletCreditLots)
          .set({
            isDisputed: false,
            remainingAmountCents: Math.max(
              0,
              lot.originalAmountCents - lot.refundedAmountCents,
            ),
          })
          .where(eq(walletCreditLots.id, lot.id));
        const [account] = await tx
          .update(accounts)
          .set({
            walletBalanceCents: sql`${accounts.walletBalanceCents} + ${dispute.amount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, lot.accountId))
          .returning();
        if (!account) throw new Error("Dispute account not found");
        await tx.insert(walletTransactions).values({
          accountId: lot.accountId,
          type: "adjustment",
          amountCents: dispute.amount,
          balanceAfterCents: account.walletBalanceCents,
          idempotencyKey: `stripe:${event.id}`,
          stripeEventId: event.id,
          description: "Won Stripe dispute reversal",
        });
      }
      return true;
    });
    return Response.json({ received: true, processed });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Stripe event processing failed" }, { status: 500 });
  }
}
