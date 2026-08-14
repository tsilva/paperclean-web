import { describe, expect, it } from "vitest";

import { validateUpload } from "@/lib/storage/r2";

describe("upload validation", () => {
  it("accepts supported private job inputs", () => {
    expect(() => validateUpload("application/pdf", 1024)).not.toThrow();
  });

  it("rejects unknown types and files over 100 MB", () => {
    expect(() => validateUpload("text/plain", 12)).toThrow();
    expect(() => validateUpload("image/png", 100 * 1024 * 1024 + 1)).toThrow();
  });
});
