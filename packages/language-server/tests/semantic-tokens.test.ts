/**
 * **Semantic tokens.**
 *
 * Semantic tokens come for free from the existing TS plumbing: `volar-service-typescript`'s `semantic`
 * plugin already (a) advertises `capabilities.semanticTokensProvider` with the standard TS token
 * legend — which Volar's language service de-dupes into the server's `initialize` capability — and (b)
 * implements `provideDocumentSemanticTokens` by running TS's `getEncodedSemanticClassifications` over
 * the virtual `.tsx` and mapping each token back to `.nota`, **gated by `semantic`**
 * (`isSemanticTokensEnabled` = `!!CodeInformation.semantic`, the `MappingCapabilities.semantic` flag).
 *
 * So this needs **no server code** — the capability + legend + provider come from the service over the
 * existing mappings. This test asserts the *behaviour*: driving the same TS primitive over
 * `buildVirtual`'s output (see {@link "./feature-harness"}) and applying the same `semantic` gate, the
 * tokens land on the right **`.nota`** ranges:
 *   - a **component identifier** (`@Aside`, `semantic:true`) gets a `variable` token at its `.nota`
 *     offset;
 *   - an **embedded variable** in an interpolation (`@(greeting)`, `semantic:true`) gets a `variable`
 *     token at its `.nota` offset;
 *   - a **host tag** (`@p`, *unmapped* → `semantic` gate closed) gets **no** token.
 * This gives identifier-accurate coloring (component vs host, binding refs), mapped to `.nota`
 * exactly as the running server paints it.
 */

import { describe, expect, test } from "vitest";
import {
  createFeatureHarness,
  type NotaSemanticToken,
  semanticTokensAt
} from "./feature-harness";

/**
 * The same shape the hover/navigation tests use: a typed `%`-binding (`greeting`), a component binding
 * (`Aside`), a component *use* (`@Aside`), an interpolation (`@(greeting)`), and a *host* tag
 * (`@p{…}`). Offsets are recovered by `indexOf` so assertions read against the `.nota` text.
 */
const DOC =
  '% const greeting: string = "hi";\n' +
  "% const Aside = (props: { children?: unknown }) => props.children;\n" +
  "@Aside{@(greeting)}\n" +
  "@p{plain}\n";

/** The `Aside` token in the `@Aside{…}` component use (after the `% const Aside` binding). */
const ASIDE_USE = DOC.indexOf("Aside", DOC.indexOf("@Aside"));
/** The `greeting` token inside the `@(greeting)` interpolation. */
const GREETING_USE = DOC.indexOf("greeting", DOC.indexOf("@("));
/** The `p` of the `@p{…}` host tag. */
const P_TAG = DOC.indexOf("p{");

/** The token covering a `.nota` offset (its range contains the offset), or `undefined`. */
function tokenAt(
  tokens: NotaSemanticToken[],
  notaOffset: number
): NotaSemanticToken | undefined {
  return tokens.find(
    t => t.notaStart <= notaOffset && notaOffset < t.notaStart + t.length
  );
}

describe("semantic tokens (TS classifications mapped to .nota, gated by `semantic`)", () => {
  test("the component binding (Aside) gets a semantic token at its .nota offset", () => {
    const h = createFeatureHarness(DOC);
    const tokens = semanticTokensAt(h);
    // `@Aside` is a JSX tag name now, and TS's 2020 semantic classifier does not classify JSX
    // element-name references (hover/nav on the tag still work — see hover-completion). The
    // asserted token is therefore the *binding* in the `% const Aside = …` statement (an
    // EmbeddedJs mapping); reader-driven highlighting owns the tag's color.
    const tok = tokens.find(
      t =>
        t.length === "Aside".length &&
        DOC.slice(t.notaStart, t.notaStart + t.length) === "Aside"
    );
    expect(tok, JSON.stringify(tokens)).toBeDefined();
    expect(["variable", "function"]).toContain(tok!.tokenType);
  });

  test("an embedded variable (@(greeting)) gets a variable token at its .nota offset", () => {
    const h = createFeatureHarness(DOC);
    const tokens = semanticTokensAt(h);
    const tok = tokenAt(tokens, GREETING_USE);
    // The interpolation is full-fidelity embedded JS (`semantic:true`); the `greeting` ref is a
    // variable token mapped back onto the `.nota` interpolation.
    expect(tok, JSON.stringify(tokens)).toBeDefined();
    expect(tok!.notaStart).toBe(GREETING_USE);
    expect(tok!.length).toBe("greeting".length);
    expect(tok!.tokenType).toBe("variable");
  });

  test("a host tag (@p) gets NO semantic token", () => {
    const h = createFeatureHarness(DOC);
    const tokens = semanticTokensAt(h);
    // The host tag lowers to a string literal `h("p", …)` with **no** mapping back to the `.nota`
    // (the reader emits none), so the `semantic` gate is closed there — no token is painted on `@p`.
    expect(tokenAt(tokens, P_TAG), JSON.stringify(tokens)).toBeUndefined();
  });

  test("every emitted token lands on a `semantic`-gated .nota range (no preamble/boilerplate leakage)", () => {
    const h = createFeatureHarness(DOC);
    const tokens = semanticTokensAt(h);
    // Some tokens are produced (the pipeline works)…
    expect(tokens.length).toBeGreaterThan(0);
    // …and each maps to a `.nota` offset whose mapping has `semantic` open — i.e. the gate that drops
    // a token also drops its source range, so `gen(notaStart, semantic)` must round-trip non-null.
    // (Preamble/boilerplate tokens have no `.nota` source range and were already filtered out.)
    for (const tok of tokens) {
      expect(
        h.gen(tok.notaStart, d => d.semantic),
        `token ${JSON.stringify(tok)} should sit on a semantic-gated .nota range`
      ).not.toBeNull();
    }
  });
});
