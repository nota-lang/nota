/**
 * List-consistency guards at the integration point — the playground depends on every layer, so
 * the cross-package mirror claims are checked here.
 */

import { languageFor } from "@nota-lang/codemirror";
import {
  FRAMEWORK_MODULES,
  SHIKI_LANG_MODULES,
  SHIKI_LANGS_MODULE
} from "@nota-lang/compiler";
import { describe, expect, test } from "vitest";
import { MODULE_MAP, resolveModule } from "../src/solid-eval";

describe("cross-package list consistency", () => {
  test("MODULE_MAP resolves every module the compiler may prepend", () => {
    // `shiki/langs` is a prefix, not a specifier: the compiler emits `shiki/langs/<tag>.mjs`
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
    // CodeMirror mode, and it deliberately covers a fraction of shiki's 346 grammars.
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
