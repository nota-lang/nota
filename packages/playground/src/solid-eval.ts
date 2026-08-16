/**
 * The in-browser document runner: emitted **Solid JSX** module → a live `Doc` component.
 *
 *   1. {@link babelCompile}: `@babel/standalone` + `babel-preset-solid` (generate `"dom"`) turn
 *      the reader's JSX emit into executable Solid client code — the same compilation
 *      vite-plugin-solid does in a real build, run in the page (Solid's own playground does
 *      exactly this).
 *   2. {@link evalModule}: the compiled module's `import`s (the compiler-prepended ambient
 *      bindings + babel's `solid-js/web` runtime imports) resolve against {@link MODULE_MAP} —
 *      the namespaces the playground itself bundles, so the evaluated document shares ONE Solid
 *      instance with the preview pane. `export`s are stripped (a `new Function` body is a
 *      script) and re-materialized as a `return`.
 *
 * The preview then just `render(() => <Doc/>)`s — pure CSR, where doc-state resolves
 * *reactively* (a Toc above its headings fills in live; the two-pass SSG converged form is a
 * build-time concern the CLI owns).
 */

import * as Babel from "@babel/standalone";
import * as prelude from "@nota-lang/prelude";
import * as notaSolid from "@nota-lang/solid";
import solidPreset from "babel-preset-solid";
// biome-ignore lint/style/useImportType: value namespaces — the module map hands these out at eval time.
import * as solidJs from "solid-js";
// biome-ignore lint/style/useImportType: value namespace.
import * as solidWeb from "solid-js/web";

/**
 * The modules an evaluated document can resolve: babel's compiled runtime imports
 * (`solid-js/web`), the compiler-prepended ambient bindings, and user `%import`s of the same.
 * Anything else is a pointed error — relative paths and arbitrary packages need a real build.
 */
const MODULE_MAP: Record<string, Record<string, unknown>> = {
  "solid-js": solidJs as unknown as Record<string, unknown>,
  "solid-js/web": solidWeb as unknown as Record<string, unknown>,
  "@nota-lang/solid": notaSolid as unknown as Record<string, unknown>,
  "@nota-lang/prelude": prelude as unknown as Record<string, unknown>
};

/**
 * The ambient scope injected under every evaluated document (the compiler's free-name binding,
 * materialized): the structural surface, the `solid-js` state surface, `Dynamic`, and the whole
 * prelude. The compiler also prepends real imports for the referenced subset — those resolve via
 * {@link MODULE_MAP} and shadow these (harmlessly, to the same values).
 */
function ambientScope(): Map<string, unknown> {
  const scope = new Map<string, unknown>();
  const put = (ns: Record<string, unknown>, names: readonly string[]) => {
    for (const n of names) {
      if (n in ns) scope.set(n, ns[n]);
    }
  };
  put(notaSolid as unknown as Record<string, unknown>, [
    "NotaDoc",
    "Reforest",
    "UlLi",
    "OlLi",
    "inlineComponent",
    "blockComponent"
  ]);
  put(solidJs as unknown as Record<string, unknown>, [
    "createSignal",
    "createMemo",
    "createEffect",
    "createResource",
    "createContext",
    "useContext",
    "batch",
    "untrack",
    "on",
    "onMount",
    "onCleanup",
    "children",
    "mergeProps",
    "splitProps",
    "Show",
    "For",
    "Index",
    "Switch",
    "Match",
    "Suspense",
    "ErrorBoundary"
  ]);
  put(solidWeb as unknown as Record<string, unknown>, ["Dynamic"]);
  for (const [k, v] of Object.entries(prelude)) {
    scope.set(k, v);
  }
  return scope;
}

/** Compile the emitted JSX module to executable Solid client code (generate `"dom"`). */
export function babelCompile(jsxModule: string): string {
  const out = Babel.transform(jsxModule, {
    filename: "doc.jsx",
    presets: [[solidPreset, { generate: "dom", hydratable: false }]],
    // Solid docs are modern-syntax; no down-leveling.
    sourceType: "module"
  });
  if (typeof out?.code !== "string") {
    throw new Error("babel: no output for the compiled document");
  }
  return out.code;
}

/**
 * Strip every top-level `import` declaration from `body`, resolving each against
 * {@link MODULE_MAP} into `scope` bindings (an import shadows an ambient name, matching real
 * ESM). Supports named imports (with `as`; `type` entries skipped), `* as ns`, and side-effect
 * imports (a no-op). Default/mixed clauses, unknown packages, and relative paths throw a pointed
 * error the error pane surfaces.
 */
function resolveImports(body: string, scope: Map<string, unknown>): string {
  const importRe =
    /^import\s*["']([^"']+)["'][ \t]*;?|^import\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["'][ \t]*;?/gm;
  return body.replace(
    importRe,
    (
      _m,
      bareSpec: string | undefined,
      typeOnly: string | undefined,
      clause = "",
      spec?: string
    ) => {
      if (typeOnly) {
        return "";
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
        return "";
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

/** The document component (the module's default export). */
export type DocFn = () => unknown;

/**
 * Evaluate a **babel-compiled** document module and return its exports
 * (`{ default: Doc, …named }`): resolve imports into scope bindings, strip `export`s (keeping
 * declarations), and `return` the export identifiers.
 */
export function evalModule(compiled: string): Record<string, unknown> {
  const scope = ambientScope();
  let body = resolveImports(compiled, scope);

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

  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- intentional: run the compiled document.
  const factory = new Function(
    ...scope.keys(),
    `"use strict";\n${body}\n;return { ${entries} };`
  );
  return factory(...scope.values()) as Record<string, unknown>;
}

/** Full run: emitted JSX module → compiled JS + the live `Doc` component. */
export function compileAndEval(jsxModule: string): {
  compiled: string;
  Doc: DocFn;
} {
  const compiled = babelCompile(jsxModule);
  const mod = evalModule(compiled);
  const Doc = mod.default as DocFn | undefined;
  if (typeof Doc !== "function") {
    throw new Error(
      "the compiled document has no default-export Doc component"
    );
  }
  return { compiled, Doc };
}
