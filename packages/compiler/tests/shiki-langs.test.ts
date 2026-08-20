/**
 * `src/shiki-langs.generated.ts` is the compiler's copy of shiki's catalogue — the tags it will
 * auto-import a grammar for. It is generated (scripts/gen-shiki-langs.mjs) because importing
 * shiki's own list would drag a lazy `import()` thunk per language into the compiler bundle.
 *
 * A copy goes stale. Upgrading shiki adds languages, and the symptom is silent in the direction
 * that matters: a tag shiki now ships is simply not auto-registered, and the fence renders plain
 * with a console warning nobody reads. So the generator is re-run here and compared.
 */

import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { describe, expect, test } from "vitest";
import { SHIKI_LANG_MODULES } from "../src/shiki-langs.generated";

const require_ = createRequire(import.meta.url);

/** The generator's rule, re-derived from the installed shiki. */
function installed(): string[] {
  const dir = dirname(require_.resolve("shiki/langs/rust.mjs"));
  return readdirSync(dir)
    .filter(f => f.endsWith(".mjs"))
    .map(f => f.slice(0, -".mjs".length))
    .sort();
}

describe("the generated shiki catalogue", () => {
  test("matches the installed shiki exactly", () => {
    const want = installed();
    const got = [...SHIKI_LANG_MODULES].sort();
    expect(
      got,
      "run `node scripts/gen-shiki-langs.mjs` after changing the shiki version"
    ).toEqual(want);
  });

  test("carries the aliases a reader actually writes on a fence", () => {
    // The point of keying on module basenames rather than canonical ids: ```js and ```rs are
    // what people type, and shiki publishes a module for each.
    for (const alias of ["js", "ts", "rs", "sh", "py", "bash", "jsx", "tsx"]) {
      expect(SHIKI_LANG_MODULES.has(alias), alias).toBe(true);
    }
  });

  test("does not claim a tag shiki has no module for", () => {
    expect(SHIKI_LANG_MODULES.has("wibble")).toBe(false);
  });
});
