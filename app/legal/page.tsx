import type { Metadata } from "next";
import Link from "next/link";

import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Privacy & terms" };

export default function LegalPage() {
  return (
    <main className="page-canvas inner-canvas">
      <article className="legal-shell">
        <header className="legal-header"><Brand compact /><Link href="/">Back to PaperClean</Link></header>
        <div className="page-heading legal-heading"><p className="eyebrow">Plain-language policy</p><h1>Privacy & terms</h1><p>Effective August 14, 2026. This page describes the intended v1 service behavior and should receive local legal and tax review before commercial launch.</p></div>
        <div className="legal-content">
          <section><h2>What PaperClean processes</h2><p>You upload a PDF, JPEG, or PNG for a single document-cleaning job. The file and rendered page pixels are processed to create and verify a cleaned result. Do not upload material you are not allowed to send to external processors.</p></section>
          <section><h2>AI providers</h2><p>Complete page pixels are transmitted to the configured generation and verification providers, currently OpenRouter-backed models. Provider processing is necessary to perform the service. PaperClean does not claim that documents remain solely on our infrastructure.</p></section>
          <section><h2>Retention</h2><p>Private source files, working assets, and downloadable results are stored in Cloudflare R2 only as needed for the job and are scheduled for deletion 7 days after the latest billed page completes. Account, wallet-ledger, job-status, cost, and audit metadata remain until account deletion or longer when legally required.</p></section>
          <section><h2>Wallet and charging</h2><p>Stripe sells closed-loop PaperClean credit in USD. Before processing, we show a maximum reservation. The final charge is one $0.30 job fee plus successful-page provider cost with a 30% service margin. Pages that fail verification, use the untouched original, have ambiguous provider billing, or exceed the confirmed maximum are not billed beyond the confirmed amount. Unused credit is refundable, subject to payment reversals and disputes.</p></section>
          <section><h2>Safety limits</h2><p>v1 accepts one active job per account, up to 100 MB, 100 pages, and 100 megapixels per page. Verification is conservative but cannot guarantee legal, evidentiary, archival, or regulatory suitability. Keep your original file.</p></section>
          <section><h2>Account deletion</h2><p>Clerk manages sign-in and profile controls. Deleting an account disconnects identity access and schedules remaining private objects for deletion. Financial records may be retained where payment, fraud, tax, or dispute obligations require it.</p></section>
          <section><h2>Service terms</h2><p>You are responsible for lawful content and use. PaperClean is provided without a promise that every page can be cleaned. Failed jobs return the safest available status and release unused wallet reservations. Liability, governing-law, business identity, support, and statutory consumer-rights language must be finalized before paid public availability.</p></section>
        </div>
        <footer className="site-footer"><p>PaperClean · conservative document cleanup</p><div><Link href="/">Home</Link><Link href="/history">History</Link></div></footer>
      </article>
    </main>
  );
}
