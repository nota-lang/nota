/**
 * `resolveId` fallback tests — the plugin resolves the imports *it* prepends
 * (`@nota-lang/runtime`, the default prelude) to its own copies **only when the user's project
 * can't** (pnpm's strict layout makes transitive deps unimportable from user code). Normal
 * resolution must win when it succeeds: the runtime carries module-level state (adapter, registry,
 * `raw` brand), and two instances would split it.
 *
 * Like the transform tests, the hook is invoked directly with a mock Rollup context — no full Vite
 * build needed.
 */

import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { describe, expect, test } from "vitest";
import { nota } from "../src/lib";

type ResolveIdFn = (
  this: { resolve: (...args: unknown[]) => Promise<unknown> },
  source: string,
  importer: string | undefined
) => Promise<unknown>;

/** Extract the `resolveId` hook (function or `{ handler }` ObjectHook) from the plugin. */
function getResolveId(): ResolveIdFn {
  const hook = nota().resolveId;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  if (!fn) throw new Error("plugin has no resolveId hook");
  return fn as unknown as ResolveIdFn;
}

/** A mock Rollup plugin context whose `this.resolve` yields `resolution`. */
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

describe("resolveId: fallback-only resolution of the plugin's own emit imports", () => {
  test("non-emit sources pass through untouched (no resolve probe)", async () => {
    const c = ctx(null);
    const resolveId = getResolveId();
    expect(await resolveId.call(c, "react", "/app/main.tsx")).toBeNull();
    expect(await resolveId.call(c, "./doc.nota", "/app/main.tsx")).toBeNull();
    expect(c.calls).toHaveLength(0);
  });

  test("the project's own resolution wins when it exists (runtime state identity)", async () => {
    const projectCopy = {
      id: "/app/node_modules/@nota-lang/runtime/dist/lib.js"
    };
    const c = ctx(projectCopy);
    const result = await getResolveId().call(
      c,
      "@nota-lang/runtime",
      "/app/doc.nota"
    );
    expect(result).toBe(projectCopy);
    // The probe must skip this plugin itself, or it would recurse into this very hook.
    expect(c.calls[0]?.[2]).toMatchObject({ skipSelf: true });
  });

  test.each([
    "@nota-lang/runtime",
    "@nota-lang/prelude"
  ])("falls back to this package's copy of %s when the project can't resolve it", async source => {
    const result = (await getResolveId().call(
      ctx(null),
      source,
      "/some/user/project/doc.nota"
    )) as string;
    // An absolute path into a real on-disk copy (the workspace link in dev, the plugin's
    // node_modules when installed).
    expect(typeof result).toBe("string");
    expect(isAbsolute(result)).toBe(true);
    expect(result).toContain(source.split("/")[1]);
    expect(existsSync(result)).toBe(true);
  });
});
