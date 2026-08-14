import { afterEach, describe, expect, it, vi } from "vitest";

describe("conversion kill switch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps conversion disabled by default", async () => {
    vi.stubEnv("PAPERCLEAN_CONVERSION_ENABLED", "");
    const { featureFlags } = await import("@/lib/env");

    expect(featureFlags.conversion).toBe(false);
  });

  it("requires an explicit true value to enable conversion", async () => {
    vi.stubEnv("PAPERCLEAN_CONVERSION_ENABLED", "true");
    const { featureFlags } = await import("@/lib/env");

    expect(featureFlags.conversion).toBe(true);
  });

  it("rejects confirmation before authentication or wallet access", async () => {
    vi.stubEnv("PAPERCLEAN_CONVERSION_ENABLED", "false");
    const { POST } = await import("@/app/api/jobs/[id]/confirm/route");

    const response = await POST(new Request("http://localhost/api/jobs/example/confirm"), {
      params: Promise.resolve({ id: "example" }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Document conversion is temporarily unavailable",
    });
  });
});
