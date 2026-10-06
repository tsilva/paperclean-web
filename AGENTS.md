## Product Specifications

Before every task in this repository, use the `$specs-author` skill to read the entire root `SPECS.md`. Before finishing, reread it and check the task and conversation for new or changed stakeholder intent.

- Treat `SPECS.md` as the persistent source of stakeholder requirements that cannot be inferred reliably from code or remembered conversations.
- Apply the scope test to proposed and existing requirements: root `SPECS.md` contains only project-wide intent; scoped intent belongs in its nearest authoritative specification and must not be broadened to fit the root.
- If the task, repository, or user request contradicts, omits, or ambiguously interprets the specification, tell the user. Continue safe exploration and work that does not depend on resolving the issue, but never silently choose an interpretation.
- Never edit `SPECS.md` from inference. Propose the exact change, explain why it reflects stakeholder intent, and edit the file only after the user explicitly approves that exact change.
- Keep `SPECS.md` complete, concise, and compacted. It must contain stakeholder intent rather than implementation, architecture, operations, or transient project detail.

## Secrets

Default dev fetches the fixed `paperclean-web`, Development `/`, project via the saved human Infisical login. `pnpm preview:local` clears service credentials without fetching any secrets and never dispatches documents. Production uses `paperclean-web-production`, Production `/`; Clerk and Stripe credentials and webhook signing secrets are managed there. Preserve the existing Vercel conversion kill-switch. Keep Cloudflare processor credentials separate until explicitly verified there. Never log secrets, signed URLs or document data, reset a database, dispatch a job or charge a wallet during migration verification. Preserve existing processor edits. Run `test:secrets`, app tests, lint, typecheck and build.
