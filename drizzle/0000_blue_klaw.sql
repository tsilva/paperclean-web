CREATE TYPE "public"."job_status" AS ENUM('inspecting', 'awaiting_confirmation', 'queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."page_status" AS ENUM('pending', 'running', 'model_generated_clean', 'model_assisted_clean', 'source_preserving_clean', 'original_fallback', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_type" AS ENUM('topup', 'charge', 'refund', 'dispute', 'adjustment');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"stripe_customer_id" text,
	"wallet_balance_cents" integer DEFAULT 0 NOT NULL,
	"reserved_balance_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_reserved_balance_nonnegative" CHECK ("accounts"."reserved_balance_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "job_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_pages" (
	"job_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"status" "page_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_cost_micros" bigint DEFAULT 0 NOT NULL,
	"charge_cents" integer DEFAULT 0 NOT NULL,
	"fallback_reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_pages_job_id_page_number_pk" PRIMARY KEY("job_id","page_number")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"output_key" text,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"source_bytes" bigint NOT NULL,
	"status" "job_status" DEFAULT 'inspecting' NOT NULL,
	"estimated_max_charge_cents" integer,
	"reserved_cents" integer DEFAULT 0 NOT NULL,
	"charged_cents" integer DEFAULT 0 NOT NULL,
	"page_total" integer,
	"pages_succeeded" integer DEFAULT 0 NOT NULL,
	"pages_fallback" integer DEFAULT 0 NOT NULL,
	"processor_version" text,
	"failure_code" text,
	"failure_message" text,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "jobs_charge_values_nonnegative" CHECK ("jobs"."reserved_cents" >= 0 and "jobs"."charged_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_objects" (
	"object_key" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"bytes" bigint NOT NULL,
	"verified_at" timestamp with time zone,
	"purge_after" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_credit_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"original_amount_cents" integer NOT NULL,
	"remaining_amount_cents" integer NOT NULL,
	"stripe_checkout_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"refunded_amount_cents" integer DEFAULT 0 NOT NULL,
	"is_disputed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"job_id" uuid,
	"type" "wallet_transaction_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"balance_after_cents" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"stripe_event_id" text,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_pages" ADD CONSTRAINT "job_pages_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_objects" ADD CONSTRAINT "uploaded_objects_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_credit_lots" ADD CONSTRAINT "wallet_credit_lots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_clerk_user_id_unique" ON "accounts" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_stripe_customer_id_unique" ON "accounts" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_events_event_id_unique" ON "job_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "jobs_account_created_idx" ON "jobs" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_object_key_unique" ON "jobs" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_one_active_per_account" ON "jobs" USING btree ("account_id") WHERE "jobs"."status" in ('inspecting', 'awaiting_confirmation', 'queued', 'running');--> statement-breakpoint
CREATE INDEX "uploaded_objects_purge_idx" ON "uploaded_objects" USING btree ("purge_after");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_credit_lots_session_unique" ON "wallet_credit_lots" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_transactions_idempotency_unique" ON "wallet_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "wallet_transactions_account_created_idx" ON "wallet_transactions" USING btree ("account_id","created_at");