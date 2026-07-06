/**
 * `@nota-lang/compiler` — `highlightSpans` (reader-driven highlight spans via the node wasm).
 *
 * This is the source of truth for the language server's reader-driven semantic tokens. It drives
 * the **node-target** wasm reader (`oxc/napi/nota_wasm/pkg-node`), so it requires
 * that package to be built (`wasm-pack build napi/nota_wasm --target nodejs --out-dir pkg-node
 * --out-name nota_wasm`). If the node wasm is absent, the suite is skipped rather than failing the
 * whole package (mirrors `virtual.test.ts`'s binary-presence guard).
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { highlightKindNames, highlightSpans } from "../src/lib";

const here = dirname(fileURLToPath(import.meta.url));
const nodeWasm =
  process.env.NOTA_WASM_NODE ??
  join(
    here,
    "..",
    "..",
    "..",
    "oxc",
    "napi",
    "nota_wasm",
    "pkg-node",
    "nota_wasm.js"
  );
const suite = existsSync(nodeWasm) ? describe : describe.skip;

suite("highlightSpans (node wasm reader)", () => {
  test("classifies element head, prop, and interpolation spans", () => {
    const src = "@em{hi} @Aside[k: 1]{y} @name";
    const spans = highlightSpans(src);

    // Every span is a well-formed byte range within the source.
    for (const s of spans) {
      expect(s.end).toBeGreaterThanOrEqual(s.start);
      expect(s.end).toBeLessThanOrEqual(src.length);
      expect(typeof s.kind).toBe("string");
    }

    const has = (kind: string, text: string) =>
      spans.some(s => s.kind === kind && src.slice(s.start, s.end) === text);

    expect(has("tag-host", "em")).toBe(true);
    expect(has("tag-component", "Aside")).toBe(true);
    expect(has("prop-name", "k")).toBe(true);
    expect(has("interpolation", "name")).toBe(true);
  });

  test("kind names are a stable, non-empty legend indexable by triple value", () => {
    const names = highlightKindNames();
    expect(names.length).toBeGreaterThan(0);
    expect(names[0]).toBe("sigil");
    expect(names).toContain("js-keyword");
  });

  test("throws on a source that fails to parse (caller serves last-good)", () => {
    // A `%` block whose JS is broken makes the highlight parse fail. The plugin catches this and
    // serves its cached tokens; here we just assert the throw contract.
    expect(() => highlightSpans("% const = = =\n")).toThrow();
  });
});
