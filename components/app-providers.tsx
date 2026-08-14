import { ClerkProvider } from "@clerk/nextjs";

import { featureFlags } from "@/lib/env";

export function AppProviders({ children }: { children: React.ReactNode }) {
  if (!featureFlags.clerk) return children;
  return <ClerkProvider>{children}</ClerkProvider>;
}
