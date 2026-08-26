import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const requireFromRoot = createRequire(import.meta.url);
const requireFromWorker = createRequire(
  new URL("../cloudflare/package.json", import.meta.url),
);

function installedVersion(requireFrom: NodeRequire, dependency: string): string {
  const entryPoint = requireFrom.resolve(dependency);
  let directory = dirname(entryPoint);

  while (directory !== dirname(directory)) {
    try {
      const metadata = JSON.parse(
        readFileSync(join(directory, "package.json"), "utf8"),
      ) as { name?: string; version?: string };
      if (metadata.name === dependency && metadata.version) return metadata.version;
    } catch {
      // Walk upward until the package root is found.
    }
    directory = dirname(directory);
  }

  throw new Error(`Unable to find package metadata for ${dependency}`);
}

function versionTuple(value: string): [number, number, number] {
  const [major, minor, patch] = value.split(".").map(Number);
  return [major, minor, patch];
}

describe("dependency security floors", () => {
  it("uses patched Nano ID and preserves zero-size generator behavior", async () => {
    const { customAlphabet } = await import("nanoid");
    expect(versionTuple(installedVersion(requireFromRoot, "nanoid"))).toEqual([
      3, 3, 18,
    ]);
    expect(customAlphabet("abcdef", 0)()).toBe("");
    expect(customAlphabet("abcdef", 12)()).toMatch(/^[a-f]{12}$/);
  });

  it("uses patched Undici and rejects header injection", async () => {
    const undiciEntry = requireFromWorker.resolve("undici");
    const { Headers } = await import(pathToFileURL(undiciEntry).href);
    expect(versionTuple(installedVersion(requireFromWorker, "undici"))).toEqual([
      7, 29, 0,
    ]);
    expect(() => new Headers({ "x-safe": "ok\r\nInjected: true" })).toThrow();
    expect(new Headers({ "x-safe": "ok" }).get("x-safe")).toBe("ok");
  });

  it("keeps every resolved esbuild branch above the development-server fix", () => {
    const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
    const versions = [...lockfile.matchAll(/^  esbuild@(\d+\.\d+\.\d+):$/gm)].map(
      ([, version]) => versionTuple(version),
    );
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(version[0] > 0 || version[1] >= 25).toBe(true);
    }
  });
});
