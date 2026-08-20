/**
 * `src/shiki-langs.generated.ts` is the compiler's copy of `@shikijs/langs`'s catalogue — the tags
 * it will auto-import a grammar for. It is generated (scripts/gen-shiki-langs.mjs) because
 * importing the package's own list would drag a lazy `import()` thunk per language into the
 * compiler bundle.
 *
 * A copy goes stale in both directions, and both are checked here against the real contract
 * ("every specifier the compiler may emit resolves") rather than against a copy of the
 * generator's rule:
 *
 * - **Missing** a tag the package now ships is silent — the fence renders plain with a console
 *   warning nobody reads. Upgrading the grammars package is when this happens.
 * - **Claiming** a tag it does not ship is loud but badly located: the emitted import fails the
 *   *integrator's* bundler, pointing at generated code rather than at the fence.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { SHIKI_LANG_MODULES } from "../src/shiki-langs.generated";

const require_ = createRequire(import.meta.url);

/** Every `@shikijs/langs` subpath, read off the installed package's exports map. */
function published(): string[] {
  const root = dirname(dirname(require_.resolve("@shikijs/langs/rust")));
  const { exports } = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8")
  ) as { exports: Record<string, unknown> };
  return Object.keys(exports)
    .filter(key => key.startsWith("./") && key !== "./package.json")
    .map(key => key.slice("./".length))
    .sort();
}

describe("the generated shiki catalogue", () => {
  test("covers every grammar the installed package publishes", () => {
    expect(
      [...SHIKI_LANG_MODULES].sort(),
      "run `node scripts/gen-shiki-langs.mjs` after changing the @shikijs/langs version"
    ).toEqual(published());
  });

  test("every tag it claims resolves as a real specifier", () => {
    // The invariant that actually matters: the compiler emits `@shikijs/langs/<tag>` for each of
    // these, and an unresolvable one breaks the integrator's build, not ours.
    const unresolvable = [...SHIKI_LANG_MODULES].filter(lang => {
      try {
        require_.resolve(`@shikijs/langs/${lang}`);
        return false;
      } catch {
        return true;
      }
    });
    expect(unresolvable).toEqual([]);
  });

  test("carries the aliases a reader actually writes on a fence", () => {
    // The point of keying on subpath names rather than canonical ids: ```js and ```rs are
    // what people type, and the package publishes a module for each.
    for (const alias of ["js", "ts", "rs", "sh", "py", "bash", "jsx", "tsx"]) {
      expect(SHIKI_LANG_MODULES.has(alias), alias).toBe(true);
    }
  });

  test("does not claim a tag the package has no module for", () => {
    expect(SHIKI_LANG_MODULES.has("wibble")).toBe(false);
  });
});
