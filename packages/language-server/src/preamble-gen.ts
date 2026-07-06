/**
 * **Generator for the resolution-independent typing preamble** (contract R22 / D3).
 *
 * The virtual `.tsx` references the runtime surface (`h` / `decode` / `Fragment` /
 * `inlineComponent` / `blockComponent`) and the ambient prelude slots (`Tex` / `CodeInline` /
 * `Heading` / …) as free identifiers. For a `.nota` **outside** `packages/*` there is no
 * `node_modules/@nota-lang/runtime` to resolve an `import` against — so the old preamble's
 * `import { h, … } from "@nota-lang/runtime"` bound to nothing and every runtime symbol became
 * `any` ("`blockComponent` has no inferred type").
 *
 * This generator inlines the runtime's **built** `.d.ts` as **module-local ambient declarations** at
 * the top of the virtual `.tsx`: the runtime's own type surface (its `.d.ts` closure
 * {@link RUNTIME_DTS_CLOSURE}) with the `export` keyword stripped (so the names are module-local, not
 * re-exported) and the intra-package relative `import`s removed (the referenced types are all in the
 * closure). The reader emits `h`/`decode`/`Fragment`/`inlineComponent`/`blockComponent` as **free
 * identifiers**, so these ambient declarations satisfy them with no import and no module resolution —
 * hence no `node_modules`. A `declare module` would instead be read as a *module augmentation* (the
 * virtual `.tsx` is a module) and fail when `@nota-lang/runtime` is absent from disk; module-local
 * ambient declarations avoid that entirely. The closure is verbatim, so the preamble **cannot drift**
 * from the shipped runtime types — a `preamble-sync` test re-runs this and fails on any mismatch.
 *
 * The output is baked into `src/preamble.generated.ts` at build time (via `scripts/gen-preamble.ts`)
 * so the shipped server carries the preamble as a constant — it does not read the runtime `.d.ts` at
 * editor runtime.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * The runtime `.d.ts` files whose declarations the emit surface's type closure needs, in dependency
 * order. Closed under intra-package imports: every relative `import` among the runtime modules
 * targets a file already in this set, so stripping those imports leaves a self-contained set of
 * declarations (each referenced type is declared in the same concatenation). Verified by the
 * `preamble-sync` test type-checking a representative virtual `.tsx`.
 */
export const RUNTIME_DTS_CLOSURE = [
  "dom",
  "raw",
  "doc",
  "vnode",
  "component",
  "h"
] as const;

/** Resolve the built runtime `dist/` directory (where the `.d.ts` live) via node resolution. */
function runtimeDistDir(): string {
  const require = createRequire(import.meta.url);
  // `@nota-lang/runtime`'s entry resolves to `dist/lib.js`; the `.d.ts` are its siblings.
  return dirname(require.resolve("@nota-lang/runtime"));
}

/**
 * Turn a runtime `.d.ts` body into module-local ambient declarations: drop the intra-package
 * relative `import`s and every `export { … }`/re-export line, and strip the leading `export ` keyword
 * from each declaration (keeping any `declare`, needed for an ambient `const`/`function` at module
 * scope). The result declares the same names *locally* (not re-exported), so the emit's free
 * `h`/`decode`/… identifiers resolve to them — with no import and no module resolution. The
 * referenced types are all in the closure, so removing the relative imports leaves every
 * cross-reference resolvable.
 */
function stripToLocalAmbient(dts: string): string {
  return dts
    .split("\n")
    .filter(line => {
      const t = line.trim();
      // Drop imports (all — the closure is self-contained) and any `export { … }` / re-export lines.
      if (/^import\b/.test(t)) return false;
      if (/^export\s*\{/.test(t)) return false;
      return true;
    })
    // Strip the leading `export ` keyword (`export declare function h` → `declare function h`,
    // `export interface X` → `interface X`), keeping `declare` for ambient const/function.
    .map(line => line.replace(/^(\s*)export\s+/, "$1"))
    .join("\n");
}

/**
 * The runtime surface as module-local ambient declarations — the `.d.ts` closure inlined so the
 * emit's free `h`/`decode`/`Fragment`/`inlineComponent`/`blockComponent` identifiers resolve to
 * their real (typed-overload) signatures without importing `@nota-lang/runtime`.
 */
function runtimeAmbientBlock(): string {
  const dir = runtimeDistDir();
  return `${RUNTIME_DTS_CLOSURE.map(name =>
    stripToLocalAmbient(readFileSync(join(dir, `${name}.d.ts`), "utf8"))
  ).join("\n")}\n`;
}

/**
 * Ambient declarations for the free identifiers the emit references that are the prelude's slots
 * (contract R14/R18f/R20a/R20c). The reader emits these as free identifiers, so they are declared as
 * ambient **globals** (not module members). Each is a plain function tag with its *real* prop shape —
 * the typed `h` overloads (a function-tag overload inferring props from the tag's parameter type)
 * make these narrowed types flow at the `h(Tex, …)` / `h(Heading, …)` call sites, so the old
 * index-signature `SLOT` workaround (which existed only to dodge a contravariant tag-assignability
 * failure) is gone. Each keeps a permissive `[prop: string]: unknown` tail so an unexpected reader-
 * emitted prop never errors ("never lie"), while the named props give completion + value-checking.
 *
 * `useState` is the framework hook the integrator supplies (the canonical golden references it as a
 * free identifier in a component body); typed as the React-shaped hook.
 */
const AMBIENT_PRELUDE = [
  "declare const useState: <T>(init: T) => [T, (v: T) => void];",
  "declare const CodeInline: (props: { lang?: string; [prop: string]: unknown }) => unknown;",
  "declare const CodeBlock: (props: { lang?: string; [prop: string]: unknown }) => unknown;",
  "declare const Tex: (props: { display?: boolean; [prop: string]: unknown }) => unknown;",
  "declare const Heading: (props: { rank: number; id?: string; [prop: string]: unknown }) => unknown;",
  "declare const Toc: (props: { [prop: string]: unknown }) => unknown;",
  "declare const Label: (props: { id?: string; [prop: string]: unknown }) => unknown;",
  "declare const Ref: (props: { id?: string; [prop: string]: unknown }) => unknown;",
  "declare const Footnote: (props: { [prop: string]: unknown }) => unknown;",
  "declare const FootnoteMark: (props: { label?: string; [prop: string]: unknown }) => unknown;",
  "declare const FootnoteText: (props: { label?: string; [prop: string]: unknown }) => unknown;",
  "declare const Footnotes: (props: { [prop: string]: unknown }) => unknown;",
  "declare const FootnotesList: (props: { [prop: string]: unknown }) => unknown;",
  "declare const Cite: (props: { [prop: string]: unknown }) => unknown;",
  "declare const Bibliography: (props: { [prop: string]: unknown }) => unknown;",
  "declare function lstset(options: { lang?: string; theme?: string; langs?: unknown; themes?: unknown[] }): void;",
  "declare function mathset(options: { macros?: Record<string, string> }): void;",
  "declare function secset(options: { [k: string]: unknown }): void;",
  "declare function bibset(options: { [k: string]: unknown }): void;",
  "declare function registerComponents(components: Record<string, unknown>): void;",
  ""
].join("\n");

/**
 * Build the full typing preamble text — the runtime surface as module-local ambient declarations
 * (inlined `.d.ts`) + the ambient prelude declarations. Whole lines only (every constituent ends in
 * `\n`), so prepending it to the bare virtual `.tsx` shifts every generated offset by a clean
 * constant and no mapping ever points *into* the preamble.
 *
 * Called at **build time** by `scripts/gen-preamble.ts` (baked into `preamble.generated.ts`) and by
 * the `preamble-sync` drift test.
 */
export function buildPreamble(): string {
  return runtimeAmbientBlock() + AMBIENT_PRELUDE;
}
