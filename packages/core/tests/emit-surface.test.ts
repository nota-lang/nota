/**
 * Reader emit policy ↔ runtime contract — the cross-language checks that never existed while
 * both sides were hand-copied lists. The reader's `emitSurface()` (wasm introspection of the
 * `oxc_transformer` constants) is the truth; this package's categorizer and export surface are
 * checked against it.
 */

import { emitSurface } from "@nota-lang/compiler/reader";
import { describe, expect, test } from "vitest";
import * as core from "../src/lib";
import { INLINE_TAGS } from "../src/reforest";

describe("reader emit surface ↔ @nota-lang/core", () => {
  test("FLOW_TAGS are disjoint from INLINE_TAGS (a flow container must categorize block)", () => {
    const { flowTags } = emitSurface();
    expect(flowTags.length).toBeGreaterThan(0);
    expect(flowTags.filter(tag => INLINE_TAGS.has(tag))).toEqual([]);
  });

  test("every structural emit name is a real export of this package", () => {
    const { structural } = emitSurface();
    expect(structural.length).toBeGreaterThan(0);
    for (const name of structural) {
      expect(
        (core as Record<string, unknown>)[name],
        `emitSurface().structural names "${name}", which @nota-lang/core does not export`
      ).toBeDefined();
    }
  });
});
