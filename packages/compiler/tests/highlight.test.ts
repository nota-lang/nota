/**
 * `@nota-lang/compiler` — `highlightSpans` (reader-driven highlight spans via the node wasm).
 *
 * This is the source of truth for the language server's reader-driven semantic tokens. It drives
 * the wasm reader vendored in this package (`src/generated`, built by `just nota-build` in oxc/).
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

  test("keeps spans available while the recovered parse reports errors", () => {
    expect(highlightSpans("% const = = =\n")).toEqual(expect.any(Array));
  });
});
