import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    const event = await verifyWebhook(request);
    if (event.type === "user.created") {
      await db()
        .insert(accounts)
        .values({ clerkUserId: event.data.id })
        .onConflictDoNothing({ target: accounts.clerkUserId });
    }
    if (event.type === "user.deleted" && event.data.id) {
      await db()
        .update(accounts)
        .set({
          clerkUserId: `deleted:${event.data.id}:${crypto.randomUUID()}`,
          isDeleted: true,
          updatedAt: new Date(),
        })
        .where(eq(accounts.clerkUserId, event.data.id));
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Invalid Clerk webhook" }, { status: 400 });
  }
}
