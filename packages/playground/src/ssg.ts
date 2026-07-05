/**
 * The in-browser SSG runner (emitted module → `{ html, manifest, Doc }`).
 *
 * Runs the compiled ESM string *in the main window* (react-dom/server SSR runs fine in the browser)
 * and returns `render(Doc)`'s output, exactly as the Node integrator does — but without a bundler or
 * a server. The mechanism (the "ambient prelude"):
 *
 *   1. `setAdapter(reactAdapter)` once, so the runtime's `▸=true` paths dispatch through React.
 *   2. Evaluate the emitted module. It (a) `import`s the emitted surface from `@nota-lang/runtime`,
 *      (b) references `useState` and the whole prelude surface (`Tex`/`CodeInline`/`CodeBlock`,
 *      contract R14; `Heading` from `#` sugar, R18f; the `Label`/`Ref`/footnote/`Cite`/… doc-state
 *      family + `secset`/`bibset` config, R20c) as **free identifiers** the integrator supplies, and
 *      (c) `export`s
 *      `Doc` (default) + any exported components. We can't run an `import`/`export`-bearing
 *      ESM string in the main window without an import map, so we strip the runtime import + ALL
 *      `export`s (keeping the declarations) and append a `return { default: Doc, …components }` built
 *      from the export identifiers parsed out of the source, evaluating the remainder via
 *      `new Function` with the runtime exports + the ambient prelude injected (the same
 *      free-identifier set the CLI injects via esbuild).
 *   3. `render(Doc)` → `{ html, manifest }`; `Doc` itself is returned alongside — the Rendered pane
 *      hands it to `hydrateDocument(Doc, { root: iframeDoc })`, which **replays** the document in
 *      capture mode and hydrates every island live (contract R15 — no registry, no manifest
 *      transport, closures over document state intact).
 */

import * as prelude from "@nota-lang/prelude";
import {
  Bibliography,
  bibset,
  Cite,
  CodeBlock,
  CodeInline,
  Footnote,
  FootnoteMark,
  Footnotes,
  FootnotesList,
  FootnoteText,
  Heading,
  Label,
  lstset,
  mathset,
  Ref,
  registerComponents,
  secset,
  Tex,
  Toc
} from "@nota-lang/prelude";
import adapter from "@nota-lang/react";
import * as runtime from "@nota-lang/runtime";
import { type RenderResult, render, setAdapter } from "@nota-lang/runtime";
import * as react from "react";
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

// The names the reader imports from "@nota-lang/runtime" — the emitted-code surface.
const RUNTIME_NAMES = [
  "h",
  "decode",
  "Fragment",
  "inlineComponent",
  "blockComponent"
] as const;

/**
 * The ambient prelude scope (contract R14, R20c): the free identifiers the emit references beyond the
 * runtime import — `useState` (framework hook) plus the *whole* standard prelude surface (the R18e
 * doc-state family joined the ambient set in R20c). The same set the CLI supplies via esbuild
 * `inject`; here they are `new Function` parameters.
 */
const AMBIENT_PRELUDE = {
  useState,
  Tex,
  CodeInline,
  CodeBlock,
  Heading,
  Toc,
  Label,
  Ref,
  Footnote,
  FootnoteMark,
  FootnoteText,
  Footnotes,
  FootnotesList,
  Cite,
  Bibliography,
  lstset,
  mathset,
  secset,
  bibset,
  registerComponents
} as const;

/**
 * The modules a user `%import` can resolve to in the playground (no bundler at eval time — these
 * are the namespaces the playground itself bundles). Anything else is a pointed error: relative
 * paths and arbitrary packages need a real build (esbuild/vite), not a `new Function` script.
 */
const MODULE_MAP: Record<string, Record<string, unknown>> = {
  "@nota-lang/prelude": prelude as unknown as Record<string, unknown>,
  "@nota-lang/runtime": runtime as unknown as Record<string, unknown>,
  react: react as unknown as Record<string, unknown>
};

/**
 * Strip every top-level `import` declaration from `body`, resolving each against
 * {@link MODULE_MAP} into `scope` bindings (an import shadows an ambient name, matching real ESM,
 * where a module-scope import wins over the injected prelude). Supports the forms the reader
 * hoists verbatim: named imports (with `as` aliases; `type` entries skipped), `* as ns`, and
 * side-effect-only imports (a no-op — the mapped modules are already loaded). Default and mixed
 * clauses, unknown packages, and relative paths throw a pointed error the error pane surfaces.
 */
function resolveImports(body: string, scope: Map<string, unknown>): string {
  // `^import` at a line start (the reader hoists imports to module scope); the clause may span
  // lines, ending at the first `from "spec"` (or the bare side-effect form).
  const importRe =
    /^import\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["'][ \t]*;?|^import\s*["']([^"']+)["'][ \t]*;?/gm;
  return body.replace(
    importRe,
    (
      _m,
      typeOnly: string | undefined,
      clause = "",
      spec?: string,
      bareSpec?: string
    ) => {
      if (typeOnly) {
        return ""; // type-only: no runtime binding
      }
      const specifier = bareSpec ?? spec ?? "";
      const mod = MODULE_MAP[specifier];
      if (!mod) {
        throw new Error(
          `The playground can only resolve imports of ${Object.keys(MODULE_MAP)
            .map(s => `"${s}"`)
            .join(", ")} — "${specifier}" is not available here. ` +
            "(A real build resolves any module; in the playground, prelude names like lstset " +
            "are also ambient — no import needed.)"
        );
      }
      if (bareSpec !== undefined) {
        return ""; // side-effect import of an already-loaded module: no-op
      }
      const ns = clause.match(/^\*\s*as\s+([A-Za-z_$][\w$]*)$/);
      if (ns) {
        scope.set(ns[1], mod);
        return "";
      }
      const braced = clause.match(/^\{([\s\S]*)\}$/);
      if (!braced) {
        throw new Error(
          `The playground supports named ({ x }), namespace (* as ns), and side-effect imports — ` +
            `rewrite \`import ${clause} from "${specifier}"\` as a named import.`
        );
      }
      for (const entry of braced[1].split(",")) {
        const e = entry.trim();
        if (e === "" || e.startsWith("type ")) {
          continue;
        }
        const m = e.match(
          /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/
        );
        if (!m) {
          throw new Error(
            `The playground could not parse the import entry "${e}".`
          );
        }
        scope.set(m[2] ?? m[1], mod[m[1]]);
      }
      return "";
    }
  );
}

/** A manifest entry: the island's debug name (`{comp}` only — R15; props are not carried). */
export interface ManifestEntry {
  comp: string;
}

/** The document component (`render`/`hydrateDocument`'s argument — the module's default export). */
export type DocFn = Parameters<typeof render>[0];

/** The SSG result: the HTML, the island manifest (debug metadata), and the document component. */
export interface SSGResult {
  html: string;
  manifest: Record<string, ManifestEntry>;
  /**
   * The evaluated module's default export. The Rendered pane replays it via
   * `hydrateDocument(Doc, { root })` (contract R15) — the same closure that produced the SSG HTML,
   * so the replay's ids match by construction.
   */
  Doc: DocFn;
}

/**
 * Evaluate an emitted Nota module and return its exports (`{ default: Doc, …named components }`).
 *
 * Strips the runtime import, resolves user `%import`s against {@link MODULE_MAP} into scope
 * bindings ({@link resolveImports}), and strips every `export` (a `new Function` body is a script,
 * not a module), keeping the declarations — then appends a `return` of the export identifiers
 * parsed from the source.
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

  // One merged scope: runtime surface + ambient prelude, then user imports (which shadow both,
  // matching ESM — a module-scope import wins over the injected ambient binding). A single map
  // also dedupes, so `%import { h }` never yields a duplicate Function parameter.
  const scope = new Map<string, unknown>();
  for (const n of RUNTIME_NAMES) {
    scope.set(n, (runtime as Record<string, unknown>)[n]);
  }
  for (const [k, v] of Object.entries(AMBIENT_PRELUDE)) {
    scope.set(k, v);
  }
  body = resolveImports(body, scope);

  // Parse export identifiers BEFORE stripping the keywords: `export default function Doc` and
  // `export let/const/function/class Name` (author `%export` bindings / meta exports — R15:
  // component bindings are document-local by default, so most modules export only Doc).
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

  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- intentional: run the emitted module.
  const factory = new Function(
    ...scope.keys(),
    `"use strict";\n${body}\n;return { ${entries} };`
  );
  return factory(...scope.values()) as Record<string, unknown>;
}

/**
 * Run the full SSG step: emitted module → `{ html, manifest, Doc }`. `Doc` (the module's default
 * export) is reused by the Rendered pane, which replays it via `hydrateDocument` (contract R15).
 */
export function runSSG(emitted: string): SSGResult {
  ensureAdapter();
  const mod = evalModule(emitted);
  const Doc = mod.default as DocFn;
  const { html, manifest } = render(Doc) as RenderResult;
  return {
    html,
    manifest: manifest as Record<string, ManifestEntry>,
    Doc
  };
}
