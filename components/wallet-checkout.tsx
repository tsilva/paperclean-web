"use client";

import { useMemo } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";

export function WalletCheckout({ stripe, fetchClientSecret }: {
  stripe: Promise<Stripe | null>;
  fetchClientSecret: () => Promise<string>;
}) {
  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <EmbeddedCheckoutProvider stripe={stripe} options={options}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
