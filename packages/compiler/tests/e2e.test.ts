/**
 * LIVE end-to-end — the live twin of the captured-fixture e2e in
 * `packages/react/tests/integration.test.ts`.
 *
 * That test renders a *captured* copy of the reader's emit (`fixtures/golden.compiled.ts`). This one
 * runs the reader **live**: `compile(integration/golden.nota)` → the reader's actual emit → rendered
 * through `@nota-lang/runtime`'s `render` + the real `@nota-lang/react` adapter → the final SSG HTML
 * + island manifest. So it closes the decode.md arc on freshly-compiled output, end to end, through
 * the compiler shim.
 *
 * **Module-resolution note.** The reader's emit is a bare ES module that (a) imports
 * `@nota-lang/runtime` (the shim prepends this) and (b) references `useState` as a *free* identifier
 * (the integrator supplies React — the reader emits no import). Rather than fight extensionless-ESM
 * `import()` resolution under vitest's Node runner (the
 * exact snag `integration/run.mjs` documents), we evaluate the emitted **body** with the runtime's
 * exports + `useState` injected as parameters via `new Function`. The runtime + adapter are the real
 * workspace packages (vitest inlines + transforms them under browser conditions — see vitest.config
 * `dom` project), so this is a genuine live render, not a re-mock.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import reactAdapter from "@nota-lang/react";
import {
  clearAdapter,
  decode,
  Fragment,
  h,
  inlineComponent,
  render,
  setAdapter
} from "@nota-lang/runtime";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { compile, RUNTIME_IMPORT } from "../src/lib";

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(here, "..", "..", "..", "integration", "golden.nota");

/**
 * Evaluate the reader's emitted module and return its default export (`Doc`).
 *
 * Strips the prepended runtime import and the `export` keywords, then runs the body in
 * a `Function` whose parameters are the runtime surface + `useState` — so the emit's free references
 * (`h`/`decode`/`Fragment`/`inlineComponent`/`useState`) resolve to the real implementations. This
 * is the live equivalent of an integrator wiring those imports for the bundler.
 */
function evalDoc(code: string): () => unknown {
  const body = code
    .slice(RUNTIME_IMPORT.length) // drop the prepended runtime import line
    .replace(/^export\s+default\s+/gm, "") // `export default function Doc()` → `function Doc()`
    .replace(/^export\s+/gm, ""); // `export let Colorized = …` → `let Colorized = …`

  // eslint-disable-next-line no-new-func
  const factory = new Function(
    "h",
    "decode",
    "Fragment",
    "inlineComponent",
    "useState",
    `${body}\nreturn Doc;`
  ) as (
    h: unknown,
    decode: unknown,
    Fragment: unknown,
    inlineComponent: unknown,
    useState: unknown
  ) => () => unknown;

  return factory(h, decode, Fragment, inlineComponent, useState);
}

beforeEach(() => setAdapter(reactAdapter));
afterEach(() => clearAdapter());

describe("LIVE e2e: compile(golden.nota) → render → SSG HTML", () => {
  test("the freshly-compiled reader emit renders to the exact SSG HTML + manifest", () => {
    const { code } = compile(readFileSync(goldenPath, "utf8"), {
      sourcePath: "golden.nota"
    });
    const Doc = evalDoc(code);

    const { html, manifest } = render(Doc);

    // The same literal SSG HTML bytes the captured-fixture e2e pins: the two `nota-ul-li`
    // sentinels coalesced into one <ul>, each <li> an island wrapping a <span> with color:red baked
    // by useState("red"), onClick absent from static HTML.
    expect(html).toBe(
      '<ul><li><nota-island data-hydration-id="1"><span style="color:red">a</span></nota-island></li>' +
        '<li><nota-island data-hydration-id="2"><span style="color:red">b</span></nota-island></li></ul>'
    );
    expect(manifest).toEqual({
      "1": { comp: "Colorized" },
      "2": { comp: "Colorized" }
    });
  });
});
