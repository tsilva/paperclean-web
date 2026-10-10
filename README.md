<p align="center">
  <img src="./logo.png" alt="PaperClean" width="300" />
  <br />
  <!-- repo-tagline:start -->
  <strong>🧹 Clean scans. Verified content 🧹</strong>
  <!-- repo-tagline:end -->
</p>

[Live Demo](https://paperclean.tsilva.eu)

PaperClean Web is a pay-as-you-go web app for people who need clean PDFs or images from document photos and poor scans without silently accepting changed content. Upload one PDF, JPEG, or PNG, review the maximum charge, and download the verified result; pages that fail verification fall back safely and are not billed.

The live service combines a Next.js interface with private uploads, per-page processing, wallet billing, and automatic seven-day file expiry. A credential-free local preview is available for reviewing the complete upload and payment flow without sending a document anywhere.

[![PaperClean — clean scans with verified content](./public/opengraph-image.png)](https://paperclean.tsilva.eu)

## Install

PaperClean Web requires Node.js 22 or newer and pnpm 10.

```bash
git clone https://github.com/tsilva/paperclean-web.git
cd paperclean-web
pnpm install --frozen-lockfile
pnpm preview:local --port auto
```

Open the printed local URL. `preview:local` explicitly clears service credentials and retains the credential-free preview, even when old dotenv files exist.

Real document conversion is disabled by default. Set `PAPERCLEAN_CONVERSION_ENABLED=true` only when the processor is ready to accept live jobs; otherwise the upload card remains an interactive preview and the server rejects process requests before reserving wallet credit or dispatching work.

## Commands

```bash
pnpm dev --port auto
pnpm preview:local --port auto    # credential-free preview
pnpm build                        # build the production app
pnpm lint                         # run ESLint
pnpm typecheck                    # check TypeScript
pnpm test                         # run the Vitest suite
pnpm db:migrate                   # apply Drizzle migrations
pnpm --dir cloudflare typecheck   # check the Cloudflare orchestrator
(cd processor && uv lock --config-file uv.toml --check)  # validate the portable lock
(cd processor && uv audit --frozen && uv run ruff check src tests)  # audit and lint
(cd processor && PYTHONPATH=src uv run pytest)  # test the processor
```

## Notes

On rewritten push history, secret scanning scans the full reachable branch history when the previous head is unavailable or no longer an ancestor. Pull-request ranges still require a valid base. Run `python3 .github/scripts/test_secret_scan.py` to verify scan-scope handling.

- Each account can run one job at a time. Supported uploads are PDF, JPEG, and PNG files up to 100 MB and 100 pages.
- Clerk handles sign-in, Stripe funds the USD wallet, and Neon Postgres stores accounts, jobs, page results, and ledger entries.
- Source and result files stay in a private Cloudflare R2 bucket and expire after seven days. Document contents are not stored in Postgres.
- Cloudflare Queues dispatch work to ephemeral containers with at most five concurrent processors. Page pixels are sent to the configured OpenRouter models for cleaning and verification.
- The maximum charge is confirmed before processing. Only pages that pass verification are billed; failed or original-fallback pages cost nothing.
- Full local processor checks also require Python 3.13 or newer and `uv`; run `uv sync --config-file uv.toml --frozen --all-groups` inside `processor/` before the first check.

## Deploy

3. Create the private `paperclean-private` R2 bucket with a seven-day lifecycle, plus the `paperclean-jobs` queue and `paperclean-jobs-dlq`.
4. Deploy the Cloudflare orchestrator with `pnpm --dir cloudflare deploy`, then configure matching dispatch and callback secrets in Cloudflare and Vercel.

Keep R2 private. Never log signed URLs, uploaded content, prompts, model responses, or document text.

## Architecture

![PaperClean Web architecture](./architecture.png)

## License

No license file has been added yet.
