/**
 * **Hover & completion + capability gates.**
 *
 * `volar-service-typescript` already yields hover (`quickInfo`) and completion over the virtual `.tsx`
 * and maps them back to `.nota` ranges via the shifted `CodeMapping`s, gated by each range's
 * `MappingCapabilities`. These tests drive the same TS calls directly over `buildVirtual`'s output
 * (see {@link "./feature-harness"}) and assert:
 *   - **hover** on an embedded interpolation shows its TS type (`@(greeting)` → `const greeting:
 *     string`); hover on a component identifier shows the binding's type (`@Aside` → `const Aside:
 *     CompFn`);
 *   - **completion** inside a `%` block / interpolation offers in-scope bindings — including a
 *     component declared earlier in the document and the ambient `useState`;
 *   - the **capability gates**: a *host* tag (`@p`) is unmapped → offers nothing; a
 *     *component identifier* (`@Aside`) is navigation+hover but **not** completion/format/structure.
 */

import { describe, expect, test } from "vitest";
import {
  completionsAt,
  createFeatureHarness,
  hoverAt
} from "./feature-harness";

/**
 * One document exercising every shape: a typed `%`-binding (`greeting`), a component binding
 * (`Aside`), a component *use* (`@Aside`), an interpolation (`@(greeting)`), and a *host* tag
 * (`@p{…}`). Offsets are recovered by `indexOf` so the assertions read against the `.nota` text.
 */
const DOC =
  '% const greeting: string = "hi";\n' +
  '% const Aside = inlineComponent((children) => h("aside", {}, children));\n' +
  "@Aside{@(greeting)}\n" +
  "@p{plain}\n";

/** `% const greeting` binding site. */
const GREETING_DECL = DOC.indexOf("greeting");
/** The `greeting` token inside the `@(greeting)` interpolation. */
const GREETING_USE = DOC.indexOf("greeting", DOC.indexOf("@("));
/** The `Aside` token in the `@Aside{…}` component use (after the `% const Aside` binding). */
const ASIDE_USE = DOC.indexOf("Aside", DOC.indexOf("@Aside"));
/** The `p` of the `@p{…}` host tag. */
const P_TAG = DOC.indexOf("p{");

describe("hover (TS quickInfo mapped to .nota)", () => {
  test("hover on an embedded interpolation @(greeting) shows its TS type", () => {
    const h = createFeatureHarness(DOC);
    // The binding is `const greeting: string` — the interpolation hover reports exactly that type.
    expect(hoverAt(h, GREETING_USE)).toBe("const greeting: string");
  });

  test("hover on a component identifier @Aside shows the binding's type", () => {
    const h = createFeatureHarness(DOC);
    // `inlineComponent(...)` returns the runtime `CompFn` type — hover on the *use* reports it,
    // proving the component-identifier range carries `semantic` (hover) back to `.nota`.
    expect(hoverAt(h, ASIDE_USE)).toBe("const Aside: CompFn");
  });

  test("hover on the % binding site itself shows its type", () => {
    const h = createFeatureHarness(DOC);
    expect(hoverAt(h, GREETING_DECL)).toBe("const greeting: string");
  });
});

describe("completion (TS completions mapped to .nota)", () => {
  test("completion inside @(greeting) offers in-scope document bindings + ambient prelude", () => {
    const h = createFeatureHarness(DOC);
    const names = completionsAt(h, GREETING_USE);
    // The earlier `%` bindings are in scope…
    expect(names.has("greeting")).toBe(true);
    expect(names.has("Aside")).toBe(true);
    // …as is the ambient-prelude `useState` (supplied by the preamble).
    expect(names.has("useState")).toBe(true);
  });

  test("completion in a % block offers a component declared earlier in the document", () => {
    // A standalone scenario: `Banner` is declared, then referenced partially in a later `%` line.
    const src =
      '% const Banner = inlineComponent((c) => h("div", {}, c));\n' +
      "% const reference = Ban;\n";
    const h = createFeatureHarness(src);
    // Cursor right after the partial `Ban` identifier.
    const at = src.indexOf("Ban;") + "Ban".length;
    const names = completionsAt(h, at);
    expect(names.has("Banner")).toBe(true);
  });
});

describe("capability gates (MappingCapabilities)", () => {
  test("a HOST tag (@p) is unmapped — no hover, no completion, no navigation", () => {
    const h = createFeatureHarness(DOC);
    // Host tags lower to string literals (`h("p", …)`) with no leverage to the `.nota`; the reader
    // emits *no* mapping for them, so every gate is closed at the host-tag range.
    expect(h.gen(P_TAG)).toBeNull();
    expect(h.gen(P_TAG, d => d.completion)).toBeNull();
    expect(h.gen(P_TAG, d => d.navigation)).toBeNull();
    expect(h.gen(P_TAG, d => d.semantic)).toBeNull();
    // …and the user-facing features therefore yield nothing there.
    expect(hoverAt(h, P_TAG)).toBeNull();
    expect(completionsAt(h, P_TAG).size).toBe(0);
  });

  test("a COMPONENT identifier (@Aside) gates navigation+hover ON, completion/format/structure OFF", () => {
    const h = createFeatureHarness(DOC);
    // The component-identifier range exists (so navigation + hover map through)…
    expect(h.gen(ASIDE_USE, d => d.navigation)).not.toBeNull();
    expect(h.gen(ASIDE_USE, d => d.semantic)).not.toBeNull();
    expect(h.gen(ASIDE_USE, d => d.verification)).not.toBeNull();
    // …but completion / format / structure are gated OFF (a component reference is not a place to
    // autocomplete-from, reformat, or fold — `@Aside → navigation+hover`).
    expect(h.gen(ASIDE_USE, d => d.completion)).toBeNull();
    expect(h.gen(ASIDE_USE, d => d.format)).toBeNull();
    expect(h.gen(ASIDE_USE, d => d.structure)).toBeNull();
  });

  test("an EMBEDDED interpolation (@(greeting)) gates ALL capabilities ON", () => {
    const h = createFeatureHarness(DOC);
    // Embedded JS is full-fidelity TS — every capability is open at the interpolation range.
    for (const cap of [
      (d: { completion: boolean }) => d.completion,
      (d: { format: boolean }) => d.format,
      (d: { navigation: boolean }) => d.navigation,
      (d: { semantic: boolean }) => d.semantic,
      (d: { structure: boolean }) => d.structure,
      (d: { verification: boolean }) => d.verification
    ] as const) {
      expect(h.gen(GREETING_USE, cap)).not.toBeNull();
    }
  });
});
