export const JOB_FEE_CENTS = 30;
export const PROVIDER_MARKUP_BASIS_POINTS = 3_000;
export const WALLET_PACKS_CENTS = [500, 1_000, 2_500, 5_000] as const;

export function providerMicrosToChargeCents(providerCostMicros: number): number {
  if (!Number.isSafeInteger(providerCostMicros) || providerCostMicros < 0) {
    throw new Error("providerCostMicros must be a non-negative safe integer");
  }
  return Math.ceil((providerCostMicros * (10_000 + PROVIDER_MARKUP_BASIS_POINTS)) / 100_000_000);
}

export function finalJobChargeCents(successfulProviderCostMicros: number): number {
  if (successfulProviderCostMicros === 0) return 0;
  return JOB_FEE_CENTS + providerMicrosToChargeCents(successfulProviderCostMicros);
}

export function isWalletPack(amountCents: number): amountCents is (typeof WALLET_PACKS_CENTS)[number] {
  return (WALLET_PACKS_CENTS as readonly number[]).includes(amountCents);
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}
