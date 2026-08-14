import { describe, expect, it } from "vitest";

import { signPayload, verifyPayloadSignature } from "@/lib/jobs/signatures";

describe("job request signatures", () => {
  it("accepts an exact, recent HMAC", () => {
    const now = 1_800_000_000_000;
    const timestamp = String(now / 1000);
    const body = JSON.stringify({ jobId: "job-1", action: "inspect" });
    expect(
      verifyPayloadSignature("secret", timestamp, body, signPayload("secret", timestamp, body), now),
    ).toBe(true);
  });

  it("rejects stale and modified payloads", () => {
    const now = 1_800_000_000_000;
    const timestamp = String(now / 1000 - 601);
    const signature = signPayload("secret", timestamp, "original");
    expect(verifyPayloadSignature("secret", timestamp, "changed", signature, now)).toBe(false);
    expect(verifyPayloadSignature("secret", timestamp, "original", signature, now)).toBe(false);
  });
});
