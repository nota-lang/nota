/**
 * The in-browser document runner: emitted **Solid JSX** module → a live `Doc` component.
 *
 *   1. {@link babelCompile}: `@babel/standalone` + `babel-preset-solid` (generate `"dom"`) turn
 *      the reader's JSX emit into executable Solid client code — the same compilation
 *      vite-plugin-solid does in a real build, run in the page (Solid's own playground does
 *      exactly this).
 *   2. {@link evalModule}: a second, targeted `Babel.transform` pass ({@link importExportPlugin})
 *      rewrites the compiled module's `import`s (the compiler-prepended ambient bindings +
 *      babel's `solid-js/web` runtime imports + any `%import`s the document itself wrote) into
 *      {@link MODULE_MAP} lookups — the namespaces the playground itself bundles, so the
 *      evaluated document shares ONE Solid instance with the preview pane. `export`s are
 *      collected then stripped (a `new Function` body is a script) and re-materialized as a
 *      `return`. This is **AST-based, not text surgery**: a document's verbatim/template content
 *      can legitimately contain a line starting with `import`/`export` (a raw code sample), and
 *      only a real parse tells that apart from an actual module boundary.
 *
 * The preview then just `render(() => <Doc/>)`s — pure CSR, where doc-state resolves
 * *reactively* (a Toc above its headings fills in live; the two-pass SSG converged form is a
 * build-time concern the CLI owns).
 */

import * as Babel from "@babel/standalone";
import {
  CORE_RUNTIME_NAMES,
  SOLID_AMBIENT_NAMES,
  SOLID_WEB_NAMES
} from "@nota-lang/compiler";
import * as notaSolid from "@nota-lang/core";
import * as prelude from "@nota-lang/prelude";
import solidPreset from "babel-preset-solid";
import * as solidJs from "solid-js";
import * as solidWeb from "solid-js/web";

/**
 * The modules an evaluated document can resolve: babel's compiled runtime imports
 * (`solid-js/web`), the compiler-prepended ambient bindings, and user `%import`s of the same.
 * Anything else is a pointed error — relative paths and arbitrary packages need a real build.
 */
export const MODULE_MAP: Record<string, Record<string, unknown>> = {
  "solid-js": solidJs as unknown as Record<string, unknown>,
  "solid-js/web": solidWeb as unknown as Record<string, unknown>,
  "@nota-lang/core": notaSolid as unknown as Record<string, unknown>,
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
  // The canonical name lists from the compiler — the same sets its import binding uses, so the
  // playground scope can never drift from the emit surface.
  put(notaSolid as unknown as Record<string, unknown>, CORE_RUNTIME_NAMES);
  put(solidJs as unknown as Record<string, unknown>, SOLID_AMBIENT_NAMES);
  put(solidWeb as unknown as Record<string, unknown>, SOLID_WEB_NAMES);
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
 * A hand-shaped, deliberately loose view over the Babel/ESTree node shapes
 * {@link importExportPlugin} reads and rewrites. `@babel/types`/`@babel/traverse` aren't
 * resolvable as their own packages here (only bundled inside `@babel/standalone`, which exposes
 * no `.d.ts`), so this is a minimal structural stand-in rather than an import: one flat optional-
 * field shape (instead of a true discriminated union) so every read goes through an explicit
 * runtime check — `t.isX`-style narrowing isn't available without the real types, and this way
 * nothing depends on it.
 */
interface AstNode {
  type: string;
  name?: string; // Identifier
  value?: string; // StringLiteral
  source?: AstNode | null; // ImportDeclaration.source / Export*Declaration.source
  specifiers?: AstNode[]; // ImportDeclaration.specifiers
  imported?: AstNode; // ImportSpecifier.imported
  local?: AstNode; // Import*Specifier.local
  declaration?: AstNode | null; // Export*Declaration.declaration
  declarations?: { id: AstNode }[]; // VariableDeclaration.declarations
  id?: AstNode | null; // Function/ClassDeclaration.id
}

/** The subset of a Babel `NodePath` {@link importExportPlugin} uses. */
interface AstPath {
  node: AstNode;
  remove(): void;
  replaceWith(node: AstNode): void;
}

interface AstVisitor {
  ImportDeclaration(path: AstPath): void;
  ExportDefaultDeclaration(path: AstPath): void;
  ExportNamedDeclaration(path: AstPath): void;
}

/** The default/named export names {@link importExportPlugin} collects as it strips `export`s. */
interface ExportCollector {
  defaultName: string | null;
  named: string[];
}

/**
 * A Babel plugin (parse → visit → regenerate, so string/template-literal *content* is never
 * mistaken for a module boundary — the AST-based replacement for the old `gm`-anchored regex
 * surgery): rewrites every top-level `import` declaration into {@link MODULE_MAP} lookups,
 * mutating `scope` (an import shadows an ambient name, matching real ESM — named, `* as ns`,
 * default, and side-effect forms all resolve; mixed default+named clauses resolve too, each
 * specifier independently), and removes the declaration. An unresolvable specifier (not in
 * {@link MODULE_MAP} — a relative path or an arbitrary package; a real build resolves those, the
 * playground can't) records `problem.specifier` instead of throwing mid-traversal, so the caller
 * throws once, after the transform, with a plain (non-Babel-wrapped) pointed message.
 *
 * Also collects + strips `export`/`export default` (keeping the underlying declaration) into
 * `exported`, the same shape {@link evalModule} built by hand before: a default export is
 * captured only when it's a *named* function/class declaration (the only shape the reader's emit
 * ever produces — `export default function Doc() {…}`); an `export { a, b };` list form is
 * dropped, uncaptured, matching the prior behavior.
 */
function importExportPlugin(
  scope: Map<string, unknown>,
  exported: ExportCollector,
  problem: { specifier: string | null }
): { visitor: AstVisitor } {
  return {
    visitor: {
      ImportDeclaration(path) {
        if (problem.specifier !== null) {
          return; // already found the first unresolvable import; stop resolving further ones
        }
        const specifier = path.node.source?.value;
        if (specifier === undefined) {
          return;
        }
        const mod = MODULE_MAP[specifier];
        if (!mod) {
          problem.specifier = specifier;
          return;
        }
        for (const spec of path.node.specifiers ?? []) {
          const local = spec.local?.name;
          if (!local) {
            continue;
          }
          if (spec.type === "ImportDefaultSpecifier") {
            scope.set(local, mod.default);
          } else if (spec.type === "ImportNamespaceSpecifier") {
            scope.set(local, mod);
          } else {
            // ImportSpecifier: `imported` is an Identifier (`{ x }`) or a StringLiteral (the
            // `{ "x" as y }` re-export-rename form) — either way its bound name/value is the key.
            const importedName = spec.imported?.name ?? spec.imported?.value;
            if (importedName) {
              scope.set(local, mod[importedName]);
            }
          }
        }
        path.remove();
      },
      ExportDefaultDeclaration(path) {
        const decl = path.node.declaration;
        const name = decl?.id?.name;
        if (
          decl &&
          (decl.type === "FunctionDeclaration" ||
            decl.type === "ClassDeclaration") &&
          name
        ) {
          exported.defaultName = name;
          path.replaceWith(decl);
        } else {
          // Not a named function/class declaration (unreachable from the reader's own emit,
          // which always writes `export default function Doc() {…}`) — drop it rather than risk
          // re-emitting an invalid standalone statement (an anonymous `function() {}` isn't one).
          path.remove();
        }
      },
      ExportNamedDeclaration(path) {
        const { declaration, source } = path.node;
        if (declaration) {
          if (declaration.type === "VariableDeclaration") {
            for (const d of declaration.declarations ?? []) {
              if (d.id.type === "Identifier" && d.id.name) {
                exported.named.push(d.id.name);
              }
            }
          } else if (declaration.id?.name) {
            exported.named.push(declaration.id.name);
          }
          path.replaceWith(declaration);
        } else if (!source) {
          // `export { a, b };` (a local re-export list, no `declaration`) — dropped whole,
          // matching the string-surgery predecessor (which never captured these names either).
          path.remove();
        }
        // `export { a } from "spec";` (has `source`): left alone, same as before — unreachable
        // from the reader's emit, and the prior regex didn't match this shape either.
      }
    }
  };
}

/** The document component (the module's default export). */
export type DocFn = () => unknown;

/**
 * Evaluate a **babel-compiled** document module and return its exports
 * (`{ default: Doc, …named }`): resolve imports into scope bindings, strip `export`s (keeping
 * declarations), and `return` the export identifiers. Runs its own `Babel.transform` pass
 * (parse → {@link importExportPlugin} → regenerate) — see the module docstring for why this is
 * AST-based rather than the string surgery it replaces.
 */
export function evalModule(compiled: string): Record<string, unknown> {
  const scope = ambientScope();
  const exported: ExportCollector = { defaultName: null, named: [] };
  const problem: { specifier: string | null } = { specifier: null };

  const out = Babel.transform(compiled, {
    filename: "compiled.js",
    sourceType: "module",
    plugins: [importExportPlugin(scope, exported, problem)]
  });

  if (problem.specifier !== null) {
    throw new Error(
      `The playground can only resolve imports of ${Object.keys(MODULE_MAP)
        .map(s => `"${s}"`)
        .join(", ")} — "${problem.specifier}" is not available here. ` +
        "(A real build resolves any module; in the playground, prelude names like lstset " +
        "are also ambient — no import needed.)"
    );
  }
  if (typeof out?.code !== "string") {
    throw new Error("babel: no output for the import/export rewrite");
  }
  const body = out.code;

  const entries = [
    ...(exported.defaultName ? [`default: ${exported.defaultName}`] : []),
    ...exported.named
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
