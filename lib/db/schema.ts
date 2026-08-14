import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const jobStatus = pgEnum("job_status", [
  "inspecting",
  "awaiting_confirmation",
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);

export const pageStatus = pgEnum("page_status", [
  "pending",
  "running",
  "model_generated_clean",
  "model_assisted_clean",
  "source_preserving_clean",
  "original_fallback",
  "failed",
]);

export const walletTransactionType = pgEnum("wallet_transaction_type", [
  "topup",
  "charge",
  "refund",
  "dispute",
  "adjustment",
]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    walletBalanceCents: integer("wallet_balance_cents").notNull().default(0),
    reservedBalanceCents: integer("reserved_balance_cents").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("accounts_clerk_user_id_unique").on(table.clerkUserId),
    uniqueIndex("accounts_stripe_customer_id_unique").on(table.stripeCustomerId),
    check("accounts_reserved_balance_nonnegative", sql`${table.reservedBalanceCents} >= 0`),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    outputKey: text("output_key"),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sourceBytes: bigint("source_bytes", { mode: "number" }).notNull(),
    status: jobStatus("status").notNull().default("inspecting"),
    estimatedMaxChargeCents: integer("estimated_max_charge_cents"),
    reservedCents: integer("reserved_cents").notNull().default(0),
    chargedCents: integer("charged_cents").notNull().default(0),
    pageTotal: integer("page_total"),
    pagesSucceeded: integer("pages_succeeded").notNull().default(0),
    pagesFallback: integer("pages_fallback").notNull().default(0),
    processorVersion: text("processor_version"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("jobs_account_created_idx").on(table.accountId, table.createdAt),
    uniqueIndex("jobs_object_key_unique").on(table.objectKey),
    uniqueIndex("jobs_one_active_per_account")
      .on(table.accountId)
      .where(sql`${table.status} in ('inspecting', 'awaiting_confirmation', 'queued', 'running')`),
    check(
      "jobs_charge_values_nonnegative",
      sql`${table.reservedCents} >= 0 and ${table.chargedCents} >= 0`,
    ),
  ],
);

export const jobPages = pgTable(
  "job_pages",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    status: pageStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    providerCostMicros: bigint("provider_cost_micros", { mode: "number" }).notNull().default(0),
    chargeCents: integer("charge_cents").notNull().default(0),
    fallbackReason: text("fallback_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.jobId, table.pageNumber] })],
);

export const jobEvents = pgTable(
  "job_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("job_events_event_id_unique").on(table.eventId)],
);

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    type: walletTransactionType("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    balanceAfterCents: integer("balance_after_cents").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    stripeEventId: text("stripe_event_id"),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("wallet_transactions_idempotency_unique").on(table.idempotencyKey),
    index("wallet_transactions_account_created_idx").on(table.accountId, table.createdAt),
  ],
);

export const walletCreditLots = pgTable(
  "wallet_credit_lots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    originalAmountCents: integer("original_amount_cents").notNull(),
    remainingAmountCents: integer("remaining_amount_cents").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    refundedAmountCents: integer("refunded_amount_cents").notNull().default(0),
    isDisputed: boolean("is_disputed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("wallet_credit_lots_session_unique").on(table.stripeCheckoutSessionId),
  ],
);

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uploadedObjects = pgTable(
  "uploaded_objects",
  {
    objectKey: text("object_key").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    bytes: bigint("bytes", { mode: "number" }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    purgeAfter: timestamp("purge_after", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("uploaded_objects_purge_idx").on(table.purgeAfter)],
);

export type Account = typeof accounts.$inferSelect;
export type Job = typeof jobs.$inferSelect;
