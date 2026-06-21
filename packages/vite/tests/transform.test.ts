/**
 * `@nota-lang/vite` transform-plugin tests (impl §3.6 layer 1 — "Transform unit tests", mirroring
 * mdx's plugin test in `references/mdx/packages/rollup/lib/index.js`).
 *
 * We invoke the plugin's `transform` hook **directly** — no full Vite build needed — and assert:
 *   - a `.nota` id → JS module + sourcemap shape out (with the contract §1 runtime import prepended,
 *     since the hook delegates to the real `@nota-lang/compiler` → oxc reader);
 *   - a non-`.nota` id → `null` (passthrough);
 *   - extension filtering, including Vite's `?query` suffix (`foo.nota?import`, HMR `?t=…`);
 *   - a configurable extension list.
 *
 * These drive the real reader subprocess (via the compiler shim), so they require the pre-built
 * `oxc/target/release/examples/nota_compile`.
 */

import type { Plugin } from "vite";
import { describe, expect, test } from "vitest";
import { nota } from "../src/lib";

const NOTA_SOURCE =
  "%let Note = blockComponent((children) => @aside{@children})\n@Note{Hello @em{world}}\n";

/**
 * Vite types `transform` as an `ObjectHook` (either a function or `{ handler }`). Our plugin uses
 * the plain-function form; this normalizes either shape and invokes it with the plugin as `this`
 * (the real Rollup/Vite calls the hook with the plugin context as `this`; our hook doesn't touch it).
 */
async function runTransform(plugin: Plugin, code: string, id: string) {
  const hook = plugin.transform;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  if (!fn) throw new Error("plugin has no transform hook");
  return await (
    fn as (this: unknown, code: string, id: string) => unknown
  ).call({}, code, id);
}

describe("nota() plugin shape", () => {
  test("is a Vite plugin named @nota-lang/vite with enforce:pre and a transform hook", () => {
    const plugin = nota();
    expect(plugin.name).toBe("@nota-lang/vite");
    expect(plugin.enforce).toBe("pre");
    expect(plugin.transform).toBeTypeOf("function");
  });
});

describe("transform: .nota id → JS + sourcemap shape", () => {
  test("compiles a .nota id to a JS module with the runtime import prepended", async () => {
    const result = (await runTransform(
      nota(),
      NOTA_SOURCE,
      "/abs/path/to/note.nota"
    )) as {
      code: string;
      map?: object;
    } | null;

    expect(result).not.toBeNull();
    expect(result?.code).toContain(
      'import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime";'
    );
    // it's real emitted JS from the reader (contract §1/§2 surface)
    expect(result?.code).toContain("export default function Doc()");
    expect(result?.code).toContain("blockComponent(");
    // F1 name as 2nd arg (single-expression body → name lands after the body's closing paren).
    expect(result?.code).toContain(', "Note");');
    expect(result?.code).toContain('h("aside", {}');
    // the result carries a `map` key (undefined for now — CLI emits no v3 map yet, see plugin docs)
    expect(result && "map" in result).toBe(true);
  });

  test("a .nota id with a ?query suffix still matches (Vite import / HMR cache-bust)", async () => {
    for (const id of [
      "/x/note.nota?import",
      "/x/note.nota?t=1717171717",
      "/x/note.nota#frag"
    ]) {
      const result = (await runTransform(nota(), NOTA_SOURCE, id)) as {
        code: string;
      } | null;
      expect(result, `expected ${id} to be transformed`).not.toBeNull();
      expect(result?.code).toContain("export default function Doc()");
    }
  });
});

describe("transform: non-.nota id → null passthrough", () => {
  test("returns null for .ts / .js / .mdx / extensionless ids", async () => {
    for (const id of [
      "/x/foo.ts",
      "/x/foo.js",
      "/x/foo.mdx",
      "/x/notanota",
      "/x/foo.nota.ts"
    ]) {
      const result = await runTransform(nota(), "export const x = 1;", id);
      expect(result, `expected ${id} to pass through`).toBeNull();
    }
  });
});

describe("transform: configurable extensions", () => {
  test("a custom extension list claims those ids and only those", async () => {
    const plugin = nota({ extensions: [".note"] });
    // claimed
    const claimed = (await runTransform(
      plugin,
      NOTA_SOURCE,
      "/x/doc.note"
    )) as { code: string } | null;
    expect(claimed).not.toBeNull();
    expect(claimed?.code).toContain("export default function Doc()");
    // .nota no longer claimed when the list is overridden
    const passed = await runTransform(plugin, NOTA_SOURCE, "/x/doc.nota");
    expect(passed).toBeNull();
  });
});

describe("transform: a malformed .nota surfaces the reader's error", () => {
  test("the hook throws (Vite turns it into a build/overlay error)", async () => {
    await expect(
      runTransform(nota(), "@p{unterminated", "/x/bad.nota")
    ).rejects.toThrow(/failed to compile/);
  });
});
