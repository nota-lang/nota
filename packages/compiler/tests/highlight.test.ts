/**
 * `@nota-lang/compiler` — `highlightSpans` (reader-driven highlight spans via the node wasm).
 *
 * This is the source of truth for the language server's reader-driven semantic tokens. It drives
 * the node-target wasm reader (`@nota-lang/wasm-node` — in development the `link:` dep on
 * `oxc/napi/nota_wasm/pkg-node`, built by `node scripts/build-wasm.mjs node`).
 */

import { describe, expect, test } from "vitest";
import { highlightKindNames, highlightSpans } from "../src/lib";

describe("highlightSpans (node wasm reader)", () => {
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
