/**
 * **Preamble drift guard** (contract R22 / D3).
 *
 * The typing preamble is *generated* from the runtime's built `.d.ts` (`scripts/gen-preamble.ts` →
 * `src/preamble.generated.ts`) and committed. This test re-runs the generator and asserts the
 * committed constant matches — so a change to the runtime's typed emit surface that is not
 * regenerated fails CI (run `npx tsx scripts/gen-preamble.ts` to fix). It also pins the invariants
 * the preamble-shift rule depends on: whole-lines-only, and no dangling intra-package imports.
 */

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
    // The typed `h` overloads and the marked-component constructors are present as module-local
    // ambient declarations (no import, no `declare module` augmentation) — so they resolve with no
    // `node_modules` (asserted end-to-end in `typed-surface.test.ts`).
    expect(PREAMBLE).toContain("declare function h<");
    expect(PREAMBLE).toContain("declare function blockComponent");
    expect(PREAMBLE).toContain("declare function inlineComponent");
    // …and the ambient prelude slots the emit references as free identifiers.
    expect(PREAMBLE).toContain("declare const Tex:");
    expect(PREAMBLE).toContain("declare const Heading:");
  });

  test("no import, no `declare module`, no dangling relative imports / stray exports", () => {
    expect(/from ["']\.\//.test(PREAMBLE)).toBe(false);
    expect(PREAMBLE.includes("declare module")).toBe(false);
    expect(/^import /m.test(PREAMBLE)).toBe(false);
    // Every declaration is module-local (the `export` keyword was stripped).
    expect(/^\s*export /m.test(PREAMBLE)).toBe(false);
  });
});
