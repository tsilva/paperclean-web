import Link from "next/link";
import type { ReactNode } from "react";

import { AccountControl } from "@/components/account-control";
import { Brand } from "@/components/brand";

export function SiteHeader({
  clerkEnabled,
  wallet,
}: {
  clerkEnabled: boolean;
  wallet: ReactNode;
}) {
  return (
    <header className="site-header">
      <Brand />
      <nav className="primary-nav" aria-label="Primary navigation">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/#safety">Safety</Link>
        <Link href="/history" prefetch={false}>History</Link>
      </nav>
      <div className="account-actions">
        {wallet}
        <AccountControl clerkEnabled={clerkEnabled} />
      </div>
    </header>
  );
}
