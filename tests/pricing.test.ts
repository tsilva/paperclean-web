import { describe, expect, it } from "vitest";

import {
  finalJobChargeCents,
  isWalletPack,
  providerMicrosToChargeCents,
} from "@/lib/payments/pricing";

describe("wallet pricing", () => {
  it("adds a 30 percent margin and rounds up to whole cents", () => {
    expect(providerMicrosToChargeCents(100_000)).toBe(13);
    expect(providerMicrosToChargeCents(1)).toBe(1);
  });

  it("charges one job fee only when a verified page has provider cost", () => {
    expect(finalJobChargeCents(0)).toBe(0);
    expect(finalJobChargeCents(100_000)).toBe(43);
  });

  it("allows only the four published wallet packs", () => {
    expect(isWalletPack(500)).toBe(true);
    expect(isWalletPack(1_500)).toBe(false);
  });
});
