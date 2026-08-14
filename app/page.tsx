import {
  ArrowsLeftRight,
  CheckCircle,
  Eye,
  Info,
  LockKey,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";

import comparisonImage from "@/public/assets/document-cleaning-comparison.png";
import { SiteHeader } from "@/components/site-header";
import { UploadCard } from "@/components/upload-card";
import { currentAccount } from "@/lib/auth";
import { featureFlags } from "@/lib/env";

export default async function HomePage() {
  const account = await currentAccount();
  const previewMode = !featureFlags.clerk && !featureFlags.database;
  const balanceCents = account?.walletBalanceCents ?? (previewMode ? 840 : 0);
  const liveEnabled = Object.values(featureFlags).every(Boolean);

  return (
    <main className="page-canvas">
      <section className="app-shell">
        <SiteHeader
          balanceCents={balanceCents}
          clerkEnabled={featureFlags.clerk}
          stripeEnabled={featureFlags.stripe}
        />

        <div className="hero-grid">
          <div className="hero-copy">
            <h1>
              Turn rough document photos into clean, <span>trustworthy</span> files.
            </h1>
            <p className="hero-description">
              We clean the page, verify the content, and return the result. Private job files
              expire automatically after 7 days.
            </p>
            <UploadCard liveEnabled={liveEnabled} />
            <div className="payment-note" id="how-it-works">
              <Info size={19} weight="regular" />
              <p>
                <strong>How payment works:</strong> We show the maximum before the job.
                <br />
                Wallet credit is charged only for pages that pass verification.
              </p>
            </div>
          </div>

          <div className="comparison-column" aria-label="Document before and after comparison">
            <div className="verified-badge"><CheckCircle size={20} weight="regular" /> Verified</div>
            <div className="comparison-card">
              <div className="comparison-label before-label">Before</div>
              <div className="comparison-label after-label">After</div>
              <Image
                className="comparison-image"
                src={comparisonImage}
                alt="The same fictional invoice shown as a stained phone photo and a clean verified scan"
                priority
                sizes="(max-width: 900px) 100vw, 52vw"
              />
              <div className="comparison-handle" aria-hidden="true"><ArrowsLeftRight size={20} weight="bold" /></div>
              <div className="verification-row">
                {["Text matches", "Numbers match", "Layout verified", "Colors neutralized", "Page deskewed"].map((item) => (
                  <span key={item}><CheckCircle size={18} weight="regular" />{item}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="trust-strip" id="safety" aria-label="PaperClean safeguards">
          <article>
            <span className="trust-icon"><Eye size={27} weight="regular" /></span>
            <div><strong>5-view fidelity review</strong><p>Content checked from five angles.</p></div>
          </article>
          <article>
            <span className="trust-icon"><ShieldCheck size={27} weight="regular" /></span>
            <div><strong>Original used if verification fails</strong><p>Never changes your content silently.</p></div>
          </article>
          <article>
            <span className="trust-icon"><LockKey size={27} weight="regular" /></span>
            <div><strong>Encrypted in transit</strong><p>TLS protects every upload and result.</p></div>
          </article>
        </section>

        <footer className="site-footer">
          <p>PaperClean sends page pixels to configured AI providers for cleaning and verification.</p>
          <div><Link href="/history">History</Link><Link href="/legal">Privacy & terms</Link></div>
        </footer>
      </section>
    </main>
  );
}
