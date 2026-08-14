import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const featureFlags = {
  conversion: process.env.PAPERCLEAN_CONVERSION_ENABLED === "true",
  clerk: Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  ),
  database: Boolean(process.env.DATABASE_URL),
  stripe: Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  ),
  r2: Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  ),
  dispatch: Boolean(process.env.CLOUDFLARE_ORCHESTRATOR_URL && process.env.JOB_DISPATCH_SECRET),
} as const;

export function requiredEnv(name: string): string {
  return nonEmpty.parse(process.env[name], {
    error: () => `Missing required environment variable: ${name}`,
  });
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export function isProductionReady(): boolean {
  return Object.values(featureFlags).every(Boolean);
}
