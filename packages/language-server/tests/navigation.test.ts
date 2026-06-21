/**
 * **Definition / references / rename** — Phase W, implementation.md §5.7-W / §5.8 layer 3.
 *
 * The navigation family — go-to-definition, find-references, rename — is produced by
 * `volar-service-typescript` over the virtual `.tsx` and mapped back through the shifted
 * `CodeMapping`s (the `navigation` capability). These tests drive the same TS calls directly over
 * `buildVirtual`'s output (see {@link "./feature-harness"}) and assert the results land on the right
 * **`.nota`** ranges:
 *   - go-to-definition on a `@Aside` use lands on its `%`-block binding; on `@(greeting)`, on the
 *     `greeting` binding;
 *   - find-references from the binding finds *both* the binding and the use;
 *   - rename from either site rewrites *all* sites (binding + every use), each a real `.nota` offset.
 *
 * Cross-checks the round-trip: a `.nota` offset → generated → TS result → mapped back to the expected
 * `.nota` offset, the property that makes navigation correct end-to-end.
 */

import { describe, expect, test } from "vitest";
import {
  createFeatureHarness,
  definitionsAt,
  referencesAt,
  renameSitesAt
} from "./feature-harness";

/**
 * A document where `Aside` is bound in a `%` block and *used twice* as a component, and `greeting`
 * is bound and interpolated once. Two uses of `Aside` make the rename/references multiplicity real.
 */
const DOC =
  '% const greeting: string = "hi";\n' +
  '% const Aside = inlineComponent((children) => h("aside", {}, children));\n' +
  "@Aside{first @(greeting)}\n" +
  "@Aside{second}\n";

const GREETING_DECL = DOC.indexOf("greeting");
const GREETING_USE = DOC.indexOf("greeting", DOC.indexOf("@("));
const ASIDE_DECL = DOC.indexOf("Aside");
const ASIDE_USE_1 = DOC.indexOf("Aside", DOC.indexOf("@Aside"));
const ASIDE_USE_2 = DOC.indexOf("Aside", ASIDE_USE_1 + 1);

describe("go-to-definition (TS definitions mapped to .nota)", () => {
  test("definition on a @Aside use lands on its % const Aside binding", () => {
    const h = createFeatureHarness(DOC);
    expect(definitionsAt(h, ASIDE_USE_1)).toContain(ASIDE_DECL);
  });

  test("definition on @(greeting) lands on its % const greeting binding", () => {
    const h = createFeatureHarness(DOC);
    expect(definitionsAt(h, GREETING_USE)).toContain(GREETING_DECL);
  });
});

describe("find-references (TS references mapped to .nota)", () => {
  test("references from the Aside binding find the binding AND both uses", () => {
    const h = createFeatureHarness(DOC);
    const refs = referencesAt(h, ASIDE_DECL);
    expect(refs).toContain(ASIDE_DECL);
    expect(refs).toContain(ASIDE_USE_1);
    expect(refs).toContain(ASIDE_USE_2);
  });

  test("references from a @Aside use find every Aside site too", () => {
    const h = createFeatureHarness(DOC);
    const refs = referencesAt(h, ASIDE_USE_1);
    expect(refs).toEqual(
      expect.arrayContaining([ASIDE_DECL, ASIDE_USE_1, ASIDE_USE_2])
    );
  });

  test("references for greeting find its binding and its interpolation", () => {
    const h = createFeatureHarness(DOC);
    const refs = referencesAt(h, GREETING_DECL);
    expect(refs).toEqual(expect.arrayContaining([GREETING_DECL, GREETING_USE]));
  });
});

describe("rename (TS rename locations mapped to .nota)", () => {
  test("rename from a @Aside use rewrites the binding and BOTH uses", () => {
    const h = createFeatureHarness(DOC);
    const sites = renameSitesAt(h, ASIDE_USE_1);
    // All three Aside occurrences (binding + two uses) are rewrite targets, each a real .nota offset.
    expect(sites).toEqual([ASIDE_DECL, ASIDE_USE_1, ASIDE_USE_2]);
  });

  test("rename from the binding rewrites the same set of sites", () => {
    const h = createFeatureHarness(DOC);
    expect(renameSitesAt(h, ASIDE_DECL)).toEqual([
      ASIDE_DECL,
      ASIDE_USE_1,
      ASIDE_USE_2
    ]);
  });

  test("rename for greeting rewrites the binding and the interpolation", () => {
    const h = createFeatureHarness(DOC);
    expect(renameSitesAt(h, GREETING_USE)).toEqual([
      GREETING_DECL,
      GREETING_USE
    ]);
  });
});
