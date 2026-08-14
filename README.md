# PaperClean Web

Minimal pay-as-you-go web app for cleaning scanned PDFs. Users sign in with Clerk, fund a USD wallet through Stripe, upload one document at a time, approve a maximum charge, and receive the processed PDF. Source and result objects live in a private Cloudflare R2 bucket for no longer than seven days; the application database stores job metadata and wallet ledger entries, not document contents.

## Architecture

- **Next.js 16 on Vercel** — landing page, Clerk-authenticated app, API routes, Stripe checkout, job state, and signed download URLs.
- **Clerk** — user lifecycle and authentication.
- **Stripe** — embedded wallet top-ups and webhook-driven credit ledger.
- **Neon Postgres** — users, jobs, pages, wallet lots, and an idempotent ledger.
- **Cloudflare R2** — private, short-lived input and output objects.
- **Cloudflare Queues + Containers** — one-page-at-a-time orchestration for the existing PaperClean processor, capped at five concurrent containers.

## Local setup

Requirements: Node.js 22+, pnpm 10, and `uv`.

1. Copy `.env.example` to `.env.local` and add the service credentials.
2. Install dependencies with `pnpm install --frozen-lockfile`.
3. Apply the schema with `pnpm db:migrate`.
4. Run the application with `pnpm dev` (or supply an available numeric port supported by your local Next.js setup).

The UI falls back to a clearly labelled interactive demo when one or more production integrations are missing, so the design can still be reviewed without credentials.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --dir cloudflare typecheck
cd processor
uv sync --frozen --all-groups
uv run ruff check .
PYTHONPATH=src uv run pytest
```

## Production setup

1. Link the GitHub repository to Vercel and provision Clerk, Stripe, and Neon integrations.
2. Configure Clerk and Stripe webhooks at `/api/webhooks/clerk` and `/api/webhooks/stripe`.
3. Create the private `paperclean-private` R2 bucket with a seven-day lifecycle, the `paperclean-jobs` queue, and `paperclean-jobs-dlq`.
4. Deploy `cloudflare/wrangler.jsonc`, then set the matching job dispatch/callback secrets in Cloudflare and Vercel.
5. Add `paperclean.tsilva.eu` to the Vercel project and point the Cloudflare DNS record at the Vercel-provided CNAME target.

Keep the R2 bucket private. Never log signed URLs, uploaded content, prompts, model responses, or document text.
