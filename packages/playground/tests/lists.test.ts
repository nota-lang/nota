/**
 * List-consistency guards at the integration point — the playground depends on every layer, so
 * the cross-package mirror claims are checked here.
 */

import { languageFor } from "@nota-lang/codemirror";
import { FRAMEWORK_MODULES } from "@nota-lang/compiler";
import { BASE_LANG_NAMES } from "@nota-lang/prelude";
import { describe, expect, test } from "vitest";
import { MODULE_MAP } from "../src/solid-eval";

describe("cross-package list consistency", () => {
  test("MODULE_MAP resolves every module the compiler may prepend", () => {
    const keys = Object.keys(MODULE_MAP);
    expect(FRAMEWORK_MODULES.filter(m => !keys.includes(m))).toEqual([]);
  });

  test("the editor sub-tokenizes every fence language the prelude renders", () => {
    // BASE_LANG_NAMES is introspected from the shiki grammars (names + aliases); the CodeMirror
    // language table claims to mirror it — a rendered-but-unhighlighted fence language fails
    // here instead of drifting silently.
    const missing = BASE_LANG_NAMES.filter(name => languageFor(name) === null);
    expect(missing).toEqual([]);
  });
});
