import Link from "next/link";

import { AccountControl } from "@/components/account-control";
import { Brand } from "@/components/brand";
import { WalletButton } from "@/components/wallet-button";

export function SiteHeader({
  balanceCents,
  clerkEnabled,
  stripeEnabled,
}: {
  balanceCents: number;
  clerkEnabled: boolean;
  stripeEnabled: boolean;
}) {
  return (
    <header className="site-header">
      <Brand />
      <nav className="primary-nav" aria-label="Primary navigation">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/#safety">Safety</Link>
        <Link href="/history">History</Link>
      </nav>
      <div className="account-actions">
        <WalletButton balanceCents={balanceCents} stripeEnabled={stripeEnabled} />
        <AccountControl clerkEnabled={clerkEnabled} />
      </div>
    </header>
  );
}
