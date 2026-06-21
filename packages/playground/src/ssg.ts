/**
 * The in-browser Post-SSG runner (decode.md **stage 5**: emitted module → `{ html, manifest }`).
 *
 * Runs the compiled ESM string *in the main window* (react-dom/server SSR runs fine in the browser)
 * and returns `render(Doc)`'s output, exactly as the Node integrator does — but without a bundler or
 * a server. The mechanism (impl §4.2 / contract §9 "ambient prelude"):
 *
 *   1. `setAdapter(reactAdapter)` once, so the runtime's `▸=true` paths dispatch through React.
 *   2. Evaluate the emitted module. It (a) `import`s the emitted surface from `@nota-lang/runtime`
 *      and (b) references `useState` as a **free identifier** the integrator must supply. We can't
 *      run an `import`-bearing ESM string in the main window without an import map, so we **strip the
 *      runtime import line** and evaluate the remainder via `new Function`, injecting the runtime
 *      exports **and** React's `useState` as the ambient prelude (the same free-identifier set the
 *      CLI injects via esbuild). The module's `export default function Doc` is captured by rewriting
 *      `export default` → a return.
 *   3. `render(Doc)` → `{ html, manifest }`.
 *
 * This is the *main-window* evaluation used to populate the Post-SSG pane. The live **Rendered**
 * pane (stage "hydrated") instead loads the compiled module as a real blob ES-module inside a
 * sandboxed iframe with an import map — see `rendered.ts`.
 */

import adapter from "@nota-lang/react";
import * as runtime from "@nota-lang/runtime";
import { type RenderResult, render, setAdapter } from "@nota-lang/runtime";
import { useState } from "react";
import { RUNTIME_IMPORT } from "./compiler";

let adapterSet = false;

/** Set the React adapter once (idempotent). */
function ensureAdapter(): void {
  if (!adapterSet) {
    setAdapter(adapter);
    adapterSet = true;
  }
}

// The names the reader imports from "@nota-lang/runtime" (contract §1) — the emitted-code surface.
const RUNTIME_NAMES = [
  "h",
  "decode",
  "Fragment",
  "inlineComponent",
  "blockComponent"
] as const;

/**
 * Evaluate an emitted Nota module (which `import`s from `@nota-lang/runtime` and references
 * `useState`) and return its default-exported `Doc` component.
 *
 * Strips the prepended runtime import and rewrites `export default` → `return`, then evaluates via
 * `new Function` with the runtime surface + `useState` injected. Tolerates code with or without the
 * runtime import already prepended.
 */
export function evalDocModule(emitted: string): () => unknown {
  // Drop the runtime import (any form) — we inject those bindings as params instead.
  let body = emitted;
  if (body.startsWith(RUNTIME_IMPORT)) {
    body = body.slice(RUNTIME_IMPORT.length);
  }
  // Also strip any standalone `import ... from "@nota-lang/runtime";` line, defensively.
  body = body.replace(
    /^\s*import\s+\{[^}]*\}\s+from\s+["']@nota-lang\/runtime["'];?\s*$/m,
    ""
  );
  // Strip ALL `export`s — a `new Function` body is a script, not a module:
  //   `export default function Doc(){…}`   → `return function Doc(){…}` (the value we return)
  //   `export let/const/var/function/class X` → strip `export` (F1 hoists+exports component bindings,
  //                                              e.g. `export let Colorized = inlineComponent(...)`)
  //   `export { … };`                       → dropped
  body = body.replace(/export\s+default\s+/g, "return ");
  body = body.replace(
    /^(\s*)export\s+(?=(?:async\s+)?(?:let|const|var|function|class)\b)/gm,
    "$1"
  );
  body = body.replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, "");

  const runtimeArgs = RUNTIME_NAMES.map(
    n => (runtime as Record<string, unknown>)[n]
  );
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- intentional: run the emitted module.
  const factory = new Function(
    ...RUNTIME_NAMES,
    "useState",
    `"use strict";\n${body}`
  );
  return factory(...runtimeArgs, useState) as () => unknown;
}

/** Run the full Post-SSG step: emitted module → `{ html, manifest }` (stage 5). */
export function runSSG(emitted: string): RenderResult {
  ensureAdapter();
  const Doc = evalDocModule(emitted);
  return render(Doc as Parameters<typeof render>[0]);
}
