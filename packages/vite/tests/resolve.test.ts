/**
 * `resolveId` fallback tests — the transform plugin resolves the imports *it* prepends
 * (`@nota-lang/solid`, the default prelude, `solid-js`) to its own copies **only when the user's
 * project can't** (pnpm's strict layout makes transitive deps unimportable from user code).
 * Normal resolution must win when it succeeds: those modules carry per-instance state (the
 * doc-state context, Solid's reactive runtime), and two instances would split it.
 */

import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { describe, expect, test } from "vitest";
import { notaTransform } from "../src/lib";

type ResolveIdFn = (
  this: { resolve: (...args: unknown[]) => Promise<unknown> },
  source: string,
  importer: string | undefined
) => Promise<unknown>;

function getResolveId(): ResolveIdFn {
  const hook = notaTransform().resolveId;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  if (!fn) throw new Error("plugin has no resolveId hook");
  return fn as unknown as ResolveIdFn;
}

function ctx(resolution: unknown) {
  const calls: unknown[][] = [];
  return {
    calls,
    resolve: async (...args: unknown[]) => {
      calls.push(args);
      return resolution;
    }
  };
}

describe("resolveId: fallback-only resolution of the emit's imports", () => {
  test("non-emit sources pass through untouched (no resolve probe)", async () => {
    const c = ctx(null);
    const resolveId = getResolveId();
    expect(await resolveId.call(c, "react", "/app/main.tsx")).toBeNull();
    expect(await resolveId.call(c, "./doc.nota", "/app/main.tsx")).toBeNull();
    expect(c.calls).toHaveLength(0);
  });

  test("normal resolution wins when it succeeds", async () => {
    const winner = { id: "/app/node_modules/@nota-lang/solid/dist/lib.jsx" };
    const c = ctx(winner);
    const resolveId = getResolveId();
    expect(await resolveId.call(c, "@nota-lang/solid", "/app/doc.nota")).toBe(
      winner
    );
    expect(c.calls).toHaveLength(1);
  });

  test("falls back to this package's copy when the project can't resolve", async () => {
    const resolveId = getResolveId();
    for (const source of [
      "@nota-lang/solid",
      "@nota-lang/prelude",
      "solid-js"
    ]) {
      const c = ctx(null);
      const resolved = await resolveId.call(c, source, "/app/doc.nota");
      expect(typeof resolved).toBe("string");
      expect(isAbsolute(resolved as string)).toBe(true);
      expect(existsSync(resolved as string)).toBe(true);
    }
  });
});
