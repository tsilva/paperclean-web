import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { featureFlags } from "@/lib/env";

export class AuthenticationRequiredError extends Error {}
export class ServiceConfigurationError extends Error {}

export async function authenticatedUserId(): Promise<string | null> {
  if (!featureFlags.clerk) return null;
  const session = await auth();
  return session.userId;
}

export async function requireUserId(): Promise<string> {
  if (!featureFlags.clerk) {
    throw new ServiceConfigurationError("Clerk is not configured");
  }
  const userId = await authenticatedUserId();
  if (!userId) throw new AuthenticationRequiredError("Sign in required");
  return userId;
}

export async function accountForUser(clerkUserId: string) {
  if (!featureFlags.database) {
    throw new ServiceConfigurationError("Database is not configured");
  }
  const database = db();
  const [existing] = await database
    .select()
    .from(accounts)
    .where(eq(accounts.clerkUserId, clerkUserId))
    .limit(1);
  if (existing) return existing;
  const [created] = await database.insert(accounts).values({ clerkUserId }).returning();
  return created;
}

export async function currentAccount() {
  const userId = await authenticatedUserId();
  if (!userId || !featureFlags.database) return null;
  return accountForUser(userId);
}

export function routeError(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ServiceConfigurationError) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  console.error(error);
  return Response.json({ error: "Unexpected server error" }, { status: 500 });
}
