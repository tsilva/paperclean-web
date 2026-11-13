## Product Specifications

Before every task in this repository, use the `$specs-author` skill to read the entire root `SPECS.md`. Before finishing, reread it and check the task and conversation for new or changed stakeholder intent.

- Treat `SPECS.md` as the persistent source of stakeholder requirements that cannot be inferred reliably from code or remembered conversations.
- Apply the scope test to proposed and existing requirements: root `SPECS.md` contains only project-wide intent; scoped intent belongs in its nearest authoritative specification and must not be broadened to fit the root.
- If the task, repository, or user request contradicts, omits, or ambiguously interprets the specification, tell the user. Continue safe exploration and work that does not depend on resolving the issue, but never silently choose an interpretation.
- Never edit `SPECS.md` from inference. Propose the exact change, explain why it reflects stakeholder intent, and edit the file only after the user explicitly approves that exact change.
- Keep `SPECS.md` complete, concise, and compacted. It must contain stakeholder intent rather than implementation, architecture, operations, or transient project detail.

## Service access

Normal commands use the configured server environment. Keep credentials server-only and out of logs, browser bundles and committed files. Preserve separate Production delivery and all transport permission checks. Read-only migration audits must inspect only permissions and the migration ledger; never apply migrations or read application rows. Provisioning requires explicit administrative review before credential reads or infrastructure changes.

Preserve the conversion kill-switch, separate Cloudflare processor credentials and hosted Production Clerk/Stripe/webhook bindings. Local verification must not dispatch documents, reset databases, create jobs or charge wallets.
