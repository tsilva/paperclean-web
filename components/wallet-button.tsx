"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { Stripe } from "@stripe/stripe-js";
import { CheckCircle, CreditCard, Wallet, X } from "@phosphor-icons/react";

import { formatUsd, WALLET_PACKS_CENTS } from "@/lib/payments/pricing";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const WalletCheckout = dynamic(() => import("./wallet-checkout").then((module) => module.WalletCheckout));

export function WalletButton({ balanceCents, stripeEnabled }: { balanceCents: number; stripeEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [selected, setSelected] = useState<number>(1_000);
  const [clientSecret, setClientSecret] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const fetchClientSecret = useCallback(async () => {
    setError(undefined);
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents: selected }),
    });
    const payload = (await response.json()) as { clientSecret?: string; error?: string };
    if (!response.ok || !payload.clientSecret) {
      const message = payload.error || "Could not start checkout";
      setError(message);
      throw new Error(message);
    }
    setClientSecret(payload.clientSecret);
    return payload.clientSecret;
  }, [selected]);

  return (
    <>
      <button className="wallet-pill" type="button" onClick={() => {
        // Warm the checkout UI while the user chooses an amount. A failed
        // speculative load is handled by the actual checkout boundary later.
        void import("./wallet-checkout").catch(() => {});
        if (stripeEnabled && publishableKey && !stripePromise) {
          setStripePromise(import("@stripe/stripe-js/pure").then(({ loadStripe }) => loadStripe(publishableKey)));
        }
        setOpen(true);
      }}>
        <Wallet size={22} weight="regular" />
        <span>{formatUsd(balanceCents)} credit</span>
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="wallet-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close wallet">
              <X size={20} />
            </button>
            <div className="modal-icon"><CreditCard size={25} /></div>
            <p className="eyebrow">PaperClean wallet</p>
            <h2 id="wallet-title">Add credit before you clean</h2>
            <p className="modal-copy">Choose a one-time amount. Credit is only usable for PaperClean jobs and remains refundable while unused.</p>
            {!clientSecret ? (
              <>
                <div className="wallet-packs" aria-label="Wallet credit amount">
                  {WALLET_PACKS_CENTS.map((amount) => (
                    <button
                      className={selected === amount ? "wallet-pack selected" : "wallet-pack"}
                      type="button"
                      key={amount}
                      onClick={() => setSelected(amount)}
                    >
                      {selected === amount ? <CheckCircle size={18} weight="fill" /> : null}
                      {formatUsd(amount)}
                    </button>
                  ))}
                </div>
                {error ? <p className="form-error" role="alert">{error}</p> : null}
                <button
                  className="primary-button wide"
                  type="button"
                  onClick={() => {
                    if (!stripeEnabled || !stripePromise) {
                      setError("Connect Stripe and sign in to add live wallet credit.");
                      return;
                    }
                    void fetchClientSecret();
                  }}
                >
                  Continue with {formatUsd(selected)}
                </button>
              </>
            ) : stripePromise ? (
              <WalletCheckout stripe={stripePromise} fetchClientSecret={fetchClientSecret} />
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
