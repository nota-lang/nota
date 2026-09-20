/**
 * List-consistency guards at the integration point — the playground depends on every layer, so
 * the cross-package mirror claims are checked here.
 */

import { languageFor } from "@nota-lang/codemirror";
import {
  AMBIENT_PRELUDE_MODULES,
  FRAMEWORK_MODULES,
  SHIKI_LANG_MODULES,
  SHIKI_LANGS_MODULE,
  SOLID_AMBIENT_NAMES
} from "@nota-lang/compiler";
import * as barrel from "@nota-lang/prelude";
import * as code from "@nota-lang/prelude/code";
import * as def from "@nota-lang/prelude/def";
import * as docState from "@nota-lang/prelude/doc-state";
import * as figure from "@nota-lang/prelude/figure";
import * as tex from "@nota-lang/prelude/tex";
import { describe, expect, test } from "vitest";
import { DEFAULT_SNIPPET } from "../src/default-snippet";
import { GOLDEN_NOTA } from "../src/golden";
import { MODULE_MAP, resolveModule } from "../src/solid-eval";

describe("cross-package list consistency", () => {
  test("MODULE_MAP resolves every module the compiler may prepend", () => {
    // `@shikijs/langs` is a prefix, not a specifier: the compiler emits `@shikijs/langs/<tag>`
    // per fence tag, and `resolveModule` answers for the whole family — carrying the grammars
    // the playground honours and degrading the rest to an empty registration.
    const keys = Object.keys(MODULE_MAP);
    const prefixes = [SHIKI_LANGS_MODULE];
    const missing = FRAMEWORK_MODULES.filter(
      m => !keys.includes(m) && !prefixes.includes(m)
    );
    expect(missing).toEqual([]);
    expect(resolveModule(`${SHIKI_LANGS_MODULE}/rust.mjs`)).toBeTruthy();
    expect(resolveModule(`${SHIKI_LANGS_MODULE}/wibble.mjs`)).toEqual({
      default: []
    });
    expect(resolveModule("no-such-module")).toBeUndefined();
  });

  test("the editor sub-tokenizes every fence language the prelude renders", () => {
    // Grammars are opt-in and auto-imported per fence tag, so the set a document may ask for is
    // every tag the compiler will resolve. The CodeMirror table cannot mirror all 346, but the
    // languages this repo's documents and examples actually fence must sub-tokenize — a
    // rendered-but-unhighlighted fence language fails here instead of drifting silently.
    // Only the languages the editor claims to sub-tokenize: `languageFor` maps a fence tag to a
    // CodeMirror mode, and it deliberately covers a fraction of shiki's 360 grammars.
    const fenced = ["javascript", "typescript", "rust", "python"];
    for (const name of fenced) {
      expect(SHIKI_LANG_MODULES.has(name), `${name} is a shiki grammar`).toBe(
        true
      );
    }
    const missing = fenced.filter(name => languageFor(name) === null);
    expect(missing).toEqual([]);
  });
});

describe("the compiler's map of prelude's layout", () => {
  // AMBIENT_PRELUDE_MODULES says which submodule supplies each ambient name, and the compiler
  // emits `@nota-lang/prelude/<submodule>` off the back of it. That is a claim about another
  // package's file layout, which the compiler cannot check itself — renaming a prelude module or
  // moving a component between two would produce an emit that fails to resolve. The playground
  // depends on both, so the claim is checked here.
  //
  // Statically imported, because that is how the emit imports them: a resolution failure has to
  // surface as a failure here rather than as a runtime lookup the test environment can paper over.
  //
  // `./config` is absent deliberately — it holds the shared config object and its readonly
  // accessor, but no ambient name, since the positional setters moved beside the components they
  // configure. Nothing the compiler emits names it.
  const SUBMODULES: Record<string, Record<string, unknown>> = {
    code: code as unknown as Record<string, unknown>,
    def: def as unknown as Record<string, unknown>,
    "doc-state": docState as unknown as Record<string, unknown>,
    figure: figure as unknown as Record<string, unknown>,
    tex: tex as unknown as Record<string, unknown>
  };

  test("every submodule the compiler may name is one this test covers", () => {
    const named = new Set(Object.values(AMBIENT_PRELUDE_MODULES));
    expect([...named].sort()).toEqual(Object.keys(SUBMODULES).sort());
  });

  test("every ambient name is exported by the submodule it is mapped to", () => {
    for (const [name, module] of Object.entries(AMBIENT_PRELUDE_MODULES)) {
      const ns = SUBMODULES[module];
      expect(ns, `unknown submodule "${module}" for ${name}`).toBeTruthy();
      expect(name in ns, `${name} is not exported by prelude/${module}`).toBe(
        true
      );
    }
  });

  test("the barrel still re-exports every ambient name", () => {
    // The submodules are the emit's path; the barrel remains the hand-written one.
    const ns = barrel as unknown as Record<string, unknown>;
    const missing = Object.keys(AMBIENT_PRELUDE_MODULES).filter(
      name => !(name in ns)
    );
    expect(missing).toEqual([]);
  });
});

describe("the documents the playground ships", () => {
  /**
   * Solid names the reader still lets a document write bare, but that Solid 2 deleted. Embedded
   * document code is type-checked by the LSP worker against the generated preamble, whose ambient
   * set is `SOLID_AMBIENT_NAMES` — so one of these in the seed greets every visitor with a red
   * squiggle in the editor (and, for the ones that are values rather than types, a runtime
   * `ReferenceError` in the Rendered pane).
   */
  const REMOVED_IN_SOLID_2 = [
    "onMount",
    "splitProps",
    "mergeProps",
    "batch",
    "createResource",
    "Index",
    "Suspense",
    "ErrorBoundary",
    "classList"
  ];

  const SHIPPED: [string, string][] = [
    ["DEFAULT_SNIPPET", DEFAULT_SNIPPET],
    ["GOLDEN_NOTA", GOLDEN_NOTA]
  ];

  test("name only Solid APIs that survive into 2.0", () => {
    const vocabulary = [...REMOVED_IN_SOLID_2, ...SOLID_AMBIENT_NAMES];
    const ambient: readonly string[] = SOLID_AMBIENT_NAMES;
    for (const [label, source] of SHIPPED) {
      const used = vocabulary.filter(name =>
        new RegExp(`\\b${name}\\b`).test(source)
      );
      expect(
        used.filter(name => !ambient.includes(name)),
        label
      ).toEqual([]);
    }
  });

  test("the seed exercises at least one ambient Solid name", () => {
    // Otherwise the guard above passes vacuously forever.
    const ambient: readonly string[] = SOLID_AMBIENT_NAMES;
    expect(
      ambient.filter(name => new RegExp(`\\b${name}\\b`).test(GOLDEN_NOTA))
    ).toContain("createSignal");
  });
});
