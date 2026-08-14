import type { Metadata } from "next";
import { Clock, DownloadSimple, File, LockKey, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { currentAccount } from "@/lib/auth";
import { featureFlags } from "@/lib/env";
import { listJobs } from "@/lib/jobs/service";
import { formatUsd } from "@/lib/payments/pricing";

export const metadata: Metadata = { title: "Job history" };

export default async function HistoryPage() {
  const account = await currentAccount();
  const previewMode = !featureFlags.clerk && !featureFlags.database;
  const rows = account ? await listJobs(account.id) : [];

  return (
    <main className="page-canvas inner-canvas">
      <section className="app-shell inner-shell">
        <SiteHeader
          balanceCents={account?.walletBalanceCents ?? (previewMode ? 840 : 0)}
          clerkEnabled={featureFlags.clerk}
          stripeEnabled={featureFlags.stripe}
        />
        <div className="page-heading">
          <p className="eyebrow">Your workspace</p>
          <h1>Job history</h1>
          <p>Metadata stays with your account. Source and result files expire 7 days after completion.</p>
        </div>

        <section className="history-list" aria-label="Document jobs">
          {rows.length ? rows.map((job) => (
            <article className="history-row" key={job.id}>
              <span className="file-icon"><File size={24} /></span>
              <div className="history-name"><strong>{job.fileName}</strong><span>{job.pageTotal ?? "—"} pages · {new Date(job.createdAt).toLocaleDateString("en-US")}</span></div>
              <span className={`status status-${job.status}`}>{job.status.replaceAll("_", " ")}</span>
              <strong className="history-charge">{formatUsd(job.chargedCents)}</strong>
              {job.outputKey && job.purgeAfter && job.purgeAfter > new Date() ? (
                <Link className="download-button" href={`/api/jobs/${job.id}/download`}><DownloadSimple size={18} />Download</Link>
              ) : <span className="expired-label"><Clock size={17} />Expired</span>}
            </article>
          )) : previewMode ? (
            <article className="history-row">
              <span className="file-icon"><File size={24} /></span>
              <div className="history-name"><strong>sample-invoice.pdf</strong><span>1 page · Preview data</span></div>
              <span className="status status-succeeded">succeeded</span>
              <strong className="history-charge">$0.58</strong>
              <span className="expired-label"><Clock size={17} />Expired</span>
            </article>
          ) : (
            <div className="empty-state">
              {featureFlags.clerk ? <LockKey size={32} /> : <WarningCircle size={32} />}
              <h2>{featureFlags.clerk ? "No jobs yet" : "Sign-in is being connected"}</h2>
              <p>{featureFlags.clerk ? "Your first verified document will appear here." : "Live history appears once Clerk and Neon are configured."}</p>
              <Link className="primary-button" href="/">Clean a document</Link>
            </div>
          )}
        </section>
        <footer className="site-footer"><p>Job files are private and temporary.</p><div><Link href="/">New job</Link><Link href="/legal">Privacy & terms</Link></div></footer>
      </section>
    </main>
  );
}
