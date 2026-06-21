/**
 * The in-browser Post-SSG runner (decode.md **stage 5**: emitted module → `{ html, manifest }`) and
 * the module evaluator the **Rendered** pane reuses to hydrate islands.
 *
 * Runs the compiled ESM string *in the main window* (react-dom/server SSR runs fine in the browser)
 * and returns `render(Doc)`'s output, exactly as the Node integrator does — but without a bundler or
 * a server. The mechanism (impl §4.2 / contract §9 "ambient prelude"):
 *
 *   1. `setAdapter(reactAdapter)` once, so the runtime's `▸=true` paths dispatch through React.
 *   2. Evaluate the emitted module. It (a) `import`s the emitted surface from `@nota-lang/runtime`,
 *      (b) references `useState` as a **free identifier** the integrator supplies, and (c) `export`s
 *      `Doc` (default) + the F1-hoisted island components. We can't run an `import`/`export`-bearing
 *      ESM string in the main window without an import map, so we strip the runtime import + ALL
 *      `export`s (keeping the declarations) and append a `return { default: Doc, …components }` built
 *      from the export identifiers parsed out of the source, evaluating the remainder via
 *      `new Function` with the runtime exports + React's `useState` injected (the same free-identifier
 *      set the CLI injects via esbuild).
 *   3. `render(Doc)` → `{ html, manifest }`; the named exports become the **registry** the Rendered
 *      pane hydrates islands from.
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

/** A manifest entry (contract §8): the island component name + its JSON props. */
export interface ManifestEntry {
  comp: string;
  props: Record<string, unknown>;
}

/** The Post-SSG result: stage-5 HTML, the island manifest, and the island component registry. */
export interface SSGResult {
  html: string;
  manifest: Record<string, ManifestEntry>;
  /** The emitted module's named exports — the island components, keyed by name (for hydration). */
  registry: Record<string, unknown>;
}

/**
 * Evaluate an emitted Nota module and return its exports (`{ default: Doc, …named components }`).
 *
 * Strips the runtime import + every `export` (a `new Function` body is a script, not a module),
 * keeping the declarations, then appends a `return` of the export identifiers parsed from the source.
 */
export function evalModule(emitted: string): Record<string, unknown> {
  let body = emitted;
  if (body.startsWith(RUNTIME_IMPORT)) {
    body = body.slice(RUNTIME_IMPORT.length);
  }
  body = body.replace(
    /^\s*import\s+\{[^}]*\}\s+from\s+["']@nota-lang\/runtime["'];?\s*$/m,
    ""
  );

  // Parse export identifiers BEFORE stripping the keywords: `export default function Doc` and
  // `export let/const/function/class Name` (F1 hoists+exports the island components).
  const defMatch = body.match(
    /export\s+default\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/
  );
  const defaultName = defMatch ? defMatch[1] : null;
  const named: string[] = [];
  for (const m of body.matchAll(
    /export\s+(?:async\s+)?(?:let|const|var|function|class)\s+([A-Za-z_$][\w$]*)/g
  )) {
    named.push(m[1]);
  }

  // Strip all `export`s, keeping the declarations.
  body = body.replace(/export\s+default\s+/g, "");
  body = body.replace(
    /^(\s*)export\s+(?=(?:async\s+)?(?:let|const|var|function|class)\b)/gm,
    "$1"
  );
  body = body.replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, "");

  const entries = [
    ...(defaultName ? [`default: ${defaultName}`] : []),
    ...named
  ].join(", ");

  const runtimeArgs = RUNTIME_NAMES.map(
    n => (runtime as Record<string, unknown>)[n]
  );
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- intentional: run the emitted module.
  const factory = new Function(
    ...RUNTIME_NAMES,
    "useState",
    `"use strict";\n${body}\n;return { ${entries} };`
  );
  return factory(...runtimeArgs, useState) as Record<string, unknown>;
}

/**
 * Run the full Post-SSG step: emitted module → `{ html, manifest, registry }` (stage 5). The
 * `registry` (the module's named island components) is reused by the Rendered pane to hydrate.
 */
export function runSSG(emitted: string): SSGResult {
  ensureAdapter();
  const mod = evalModule(emitted);
  const Doc = mod.default as Parameters<typeof render>[0];
  const { html, manifest } = render(Doc) as RenderResult;

  const registry: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(mod)) {
    if (k !== "default") registry[k] = v;
  }
  return {
    html,
    manifest: manifest as Record<string, ManifestEntry>,
    registry
  };
}
