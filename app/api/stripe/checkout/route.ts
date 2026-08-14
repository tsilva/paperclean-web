import { z } from "zod";

import { accountForUser, requireUserId, routeError } from "@/lib/auth";
import { accounts } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { appUrl, featureFlags } from "@/lib/env";
import { formatUsd, isWalletPack } from "@/lib/payments/pricing";
import { stripe } from "@/lib/payments/stripe";
import { eq } from "drizzle-orm";

const requestSchema = z.object({ amountCents: z.number().int().positive() });

export async function POST(request: Request) {
  try {
    if (!featureFlags.stripe) throw new Error("Stripe is not configured");
    const { amountCents } = requestSchema.parse(await request.json());
    if (!isWalletPack(amountCents)) {
      return Response.json({ error: "Choose a supported wallet pack" }, { status: 400 });
    }
    const account = await accountForUser(await requireUserId());
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      integration_identifier: "paperclean_qmtrvksh",
      return_url: `${appUrl()}/?wallet=success&session_id={CHECKOUT_SESSION_ID}`,
      customer: account.stripeCustomerId || undefined,
      customer_creation: account.stripeCustomerId ? undefined : "always",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `${formatUsd(amountCents)} PaperClean wallet credit`,
              description: "Refundable, closed-loop credit for PaperClean document jobs",
            },
          },
        },
      ],
      metadata: { accountId: account.id, creditCents: String(amountCents) },
      payment_intent_data: { metadata: { accountId: account.id, creditCents: String(amountCents) } },
    });
    if (!session.client_secret) throw new Error("Stripe did not return a client secret");
    if (!account.stripeCustomerId && typeof session.customer === "string") {
      await db()
        .update(accounts)
        .set({ stripeCustomerId: session.customer, updatedAt: new Date() })
        .where(eq(accounts.id, account.id));
    }
    return Response.json({ clientSecret: session.client_secret });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid checkout request" }, { status: 400 });
    }
    return routeError(error);
  }
}
