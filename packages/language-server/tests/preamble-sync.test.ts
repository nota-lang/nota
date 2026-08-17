/**
 * **Preamble drift guard.**
 *
 * The typing preamble is *generated* from the hand-written ambient declarations in
 * `src/preamble-gen.ts`, coverage-guarded against the compiler's canonical free-name lists
 * (`scripts/gen-preamble.ts` → `src/preamble.generated.ts`) and committed. This test re-runs the
 * generator and asserts the committed constant matches — so a change to the typed emit surface
 * that is not regenerated fails CI (run `npx tsx scripts/gen-preamble.ts` to fix). It also pins
 * the invariants the preamble-shift rule depends on: whole-lines-only, no dangling intra-package
 * imports, and full coverage of every name the emit can reference free.
 */

import {
  AMBIENT_PRELUDE_NAMES,
  SOLID_AMBIENT_NAMES,
  CORE_RUNTIME_NAMES,
  SOLID_WEB_NAMES
} from "@nota-lang/compiler";
import { describe, expect, test } from "vitest";
import { PREAMBLE, PREAMBLE_LENGTH } from "../src/preamble";
import { buildPreamble } from "../src/preamble-gen";

describe("preamble generation", () => {
  test("the committed preamble matches a fresh generation (no drift)", () => {
    expect(PREAMBLE).toBe(buildPreamble());
  });

  test("PREAMBLE_LENGTH equals the string length", () => {
    expect(PREAMBLE_LENGTH).toBe(PREAMBLE.length);
  });

  test("whole lines only (ends in a newline) — the shift is a clean constant", () => {
    expect(PREAMBLE.endsWith("\n")).toBe(true);
  });

  test("inlines the runtime surface as module-local ambient declarations (resolution-independent)", () => {
    // The structural components are present as module-local ambient declarations (no import, no
    // `declare module` augmentation) — so they resolve with no `node_modules` (asserted
    // end-to-end in `typed-surface.test.ts`).
    expect(PREAMBLE).toContain("declare const NotaDoc");
    expect(PREAMBLE).toContain("declare const Reforest");
    // …and the ambient prelude slots the emit references as free identifiers.
    expect(PREAMBLE).toContain("declare const Tex:");
    expect(PREAMBLE).toContain("declare const Heading:");
  });

  test("covers every canonical ambient name (the union of all four compiler lists)", () => {
    // The full free-name surface an emit can reference: structural (`@nota-lang/core`),
    // `solid-js/web`, `solid-js`, and the ambient prelude. A loop, not a spot check — a name
    // added to any list without a preamble declaration must fail here.
    const allNames = [
      ...CORE_RUNTIME_NAMES,
      ...SOLID_WEB_NAMES,
      ...SOLID_AMBIENT_NAMES,
      ...AMBIENT_PRELUDE_NAMES
    ];
    for (const name of allNames) {
      expect(
        new RegExp(`^declare (const|function) ${name}\\b`, "m").test(PREAMBLE),
        `preamble is missing an ambient declaration for '${name}'`
      ).toBe(true);
    }
  });

  test("Attrs (the flow-position attrs-group marker) is declared", () => {
    // Regression: `Attrs` is in CORE_RUNTIME_NAMES but was once absent from the preamble, so
    // every document with a flow-position attrs group got "Cannot find name 'Attrs'".
    expect(PREAMBLE).toContain("declare const Attrs:");
  });

  test("no import, no `declare module`, no dangling relative imports / stray exports", () => {
    expect(/from ["']\.\//.test(PREAMBLE)).toBe(false);
    expect(PREAMBLE.includes("declare module")).toBe(false);
    expect(/^import /m.test(PREAMBLE)).toBe(false);
    // Every declaration is module-local (the `export` keyword was stripped).
    expect(/^\s*export /m.test(PREAMBLE)).toBe(false);
  });
});
