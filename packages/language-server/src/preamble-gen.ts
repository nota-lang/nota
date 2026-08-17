/**
 * **Generator for the resolution-independent typing preamble** — the typed emit surface
 * (design/solid.md) made to type-check with no `node_modules`.
 *
 * The virtual `.tsx` is **Solid JSX**: it references the structural components
 * (`NotaDoc`/`Reforest`/`UlLi`/`OlLi`/`For`/`Dynamic`), the ambient prelude components
 * (`Tex`/`Heading`/…), and the `solid-js` state surface (`createSignal`, `Show`, …) as free
 * identifiers, and its markup is JSX syntax. For a `.nota` **outside** `packages/*` there is no
 * `node_modules` to resolve imports against, so the preamble supplies everything ambiently:
 *
 * - a **global `JSX` namespace** (classic JSX resolution — no `jsxImportSource`, hence no module
 *   resolution): `Element` is `unknown`-permissive; `IntrinsicElements` seeds common elements
 *   with their distinctive attributes over a permissive open-map base (the old runtime
 *   `NotaIntrinsicElements` table) — `@a[href]` completes and value-checks while `nota-*`/custom
 *   tags stay legal ("never lie");
 * - the structural + prelude + solid surfaces as **module-local ambient declarations** —
 *   `For`/`Show`/`createSignal` carry real generic signatures, so an `@for` body's item type
 *   flows from the iterable.
 *
 * The output is baked into `src/preamble.generated.ts` (via `scripts/gen-preamble.ts`) so the
 * shipped server carries the preamble as a constant; the `preamble-sync` test fails CI on drift.
 * Whole lines only — prepending shifts every generated offset by a clean constant.
 */

import {
  AMBIENT_PRELUDE_NAMES,
  SOLID_AMBIENT_NAMES,
  CORE_RUNTIME_NAMES,
  SOLID_WEB_NAMES
} from "@nota-lang/compiler";

/**
 * The global JSX namespace (classic resolution — the TS project sets `jsx` so `.tsx` parses, and
 * this namespace types it without any `jsx-runtime` module lookup). `declare global` is legal
 * here because the virtual `.tsx` is a module (it has `export default`).
 */
/**
 * The seeded per-tag attribute types of the `JSX.IntrinsicElements` table (over the permissive
 * open-map base). Structured (not inline strings) so the seeded tag set is introspectable — the
 * completions test asserts every seeded tag is also offered by `NOTA_HOST_TAGS`.
 */
export const SEEDED_INTRINSICS: Record<string, string> = {
  a: "{ href?: string; target?: string; rel?: string; download?: string | boolean }",
  img: '{ src?: string; alt?: string; width?: number | string; height?: number | string; loading?: "eager" | "lazy" }',
  input:
    "{ type?: string; name?: string; value?: string | number; placeholder?: string; disabled?: boolean; checked?: boolean; required?: boolean; readonly?: boolean }",
  label: "{ for?: string }",
  td: "{ colspan?: number; rowspan?: number; headers?: string; scope?: string }",
  th: "{ colspan?: number; rowspan?: number; headers?: string; scope?: string }",
  ol: '{ start?: number; reversed?: boolean; type?: "1" | "a" | "A" | "i" | "I" }'
};

const JSX_NAMESPACE = [
  "interface NotaGlobalAttributes {",
  "  id?: string;",
  "  class?: string;",
  "  style?: string | Record<string, string | number>;",
  "  title?: string;",
  "  role?: string;",
  "  hidden?: boolean;",
  "  tabindex?: number;",
  '  dir?: "ltr" | "rtl" | "auto";',
  "  lang?: string;",
  "  children?: unknown;",
  "  [attr: string]: unknown;",
  "}",
  "declare global {",
  "  namespace JSX {",
  "    type Element = unknown;",
  "    interface ElementChildrenAttribute {",
  "      children: unknown;",
  "    }",
  "    interface IntrinsicElements {",
  ...Object.entries(SEEDED_INTRINSICS).map(
    ([tag, attrs]) => `      ${tag}: NotaGlobalAttributes & ${attrs};`
  ),
  "      [tag: string]: NotaGlobalAttributes;",
  "    }",
  "  }",
  "}",
  ""
].join("\n");

/**
 * The `@nota-lang/core` structural surface the emit references free (design/solid.md §The
 * pipeline; the compiler's {@link CORE_RUNTIME_NAMES} + {@link SOLID_WEB_NAMES}): the document
 * wrapper, the restructurer, the list items, `Attrs` (the flow-position attrs-group marker
 * Reforest applies to its paragraph), Solid's `For` (typed generically — the `@for` item type
 * flows), and `Dynamic` for dynamic tags.
 */
const AMBIENT_STRUCTURAL = [
  "declare const NotaDoc: (props: { children?: unknown }) => unknown;",
  "declare const Reforest: (props: { children?: unknown; tight?: boolean }) => unknown;",
  "declare const UlLi: (props: { children?: unknown }) => unknown;",
  "declare const OlLi: (props: { children?: unknown }) => unknown;",
  "declare const Attrs: (props: Record<string, unknown>) => unknown;",
  "declare const For: <T>(props: { each: readonly T[] | undefined | null; fallback?: unknown; children: (item: T, index: () => number) => unknown }) => unknown;",
  "declare const Dynamic: (props: { component: unknown; children?: unknown; [prop: string]: unknown }) => unknown;",
  ""
].join("\n");

/**
 * The `solid-js` ambient state/control-flow surface (the compiler's {@link SOLID_AMBIENT_NAMES})
 * — pragmatic signatures: generics where inference pays (signals, memos, resources, `Show`,
 * `Index`), permissive `unknown` elsewhere.
 */
const AMBIENT_SOLID = [
  "declare const createSignal: <T>(value: T, options?: { equals?: false | ((prev: T, next: T) => boolean); name?: string }) => [() => T, (v: T | ((prev: T) => T)) => T];",
  "declare const createMemo: <T>(fn: (prev?: T) => T, value?: T) => () => T;",
  "declare const createEffect: <T>(fn: (prev?: T) => T, value?: T) => void;",
  "declare const createResource: <T, S = true>(source: S | (() => S), fetcher?: (source: S) => T | Promise<T>) => [() => T | undefined, { refetch: () => void; mutate: (v: T) => T }];",
  "declare const createContext: <T>(defaultValue?: T) => { id: symbol; defaultValue: T | undefined };",
  "declare const useContext: <T>(context: { id: symbol; defaultValue: T | undefined }) => T | undefined;",
  "declare const batch: <T>(fn: () => T) => T;",
  "declare const untrack: <T>(fn: () => T) => T;",
  "declare const on: (deps: unknown, fn: (...args: unknown[]) => unknown, options?: { defer?: boolean }) => (...args: unknown[]) => unknown;",
  "declare const onMount: (fn: () => void) => void;",
  "declare const onCleanup: (fn: () => void) => void;",
  "declare const children: (fn: () => unknown) => { (): unknown; toArray(): unknown[] };",
  "declare const mergeProps: (...sources: unknown[]) => Record<string, unknown>;",
  "declare const splitProps: <T extends Record<string, unknown>>(props: T, ...keys: (keyof T)[][]) => Record<string, unknown>[];",
  "declare const Show: <T>(props: { when: T | undefined | null | false; keyed?: boolean; fallback?: unknown; children?: unknown | ((item: () => T) => unknown) }) => unknown;",
  "declare const Index: <T>(props: { each: readonly T[] | undefined | null; fallback?: unknown; children: (item: () => T, index: number) => unknown }) => unknown;",
  "declare const Switch: (props: { fallback?: unknown; children?: unknown }) => unknown;",
  "declare const Match: <T>(props: { when: T | undefined | null | false; children?: unknown }) => unknown;",
  "declare const Suspense: (props: { fallback?: unknown; children?: unknown }) => unknown;",
  "declare const ErrorBoundary: (props: { fallback: unknown | ((err: unknown, reset: () => void) => unknown); children?: unknown }) => unknown;",
  ""
].join("\n");

/**
 * Ambient declarations for the prelude components + config fns (design/solid.md §The prelude).
 * Each is a plain component with its *real* named props over a permissive `[prop: string]:
 * unknown` tail — named props give completion + value-checking; the tail keeps "never lie".
 */
const AMBIENT_PRELUDE = [
  "declare const CodeInline: (props: { children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const CodeBlock: (props: { lang?: string; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Tex: (props: { display?: boolean; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Heading: (props: { rank?: number; id?: string; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Toc: (props: { depth?: number; [prop: string]: unknown }) => unknown;",
  "declare const Label: (props: { id?: string; [prop: string]: unknown }) => unknown;",
  "declare const Ref: (props: { id?: string; page?: string; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Footnote: (props: { id?: string; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Footnotes: (props: { [prop: string]: unknown }) => unknown;",
  "declare const FootnotesList: (props: { [prop: string]: unknown }) => unknown;",
  "declare const Cite: (props: { children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Bibliography: (props: { [prop: string]: unknown }) => unknown;",
  "declare const Title: (props: { children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Definition: (props: { id: string; label?: unknown; tooltip?: unknown; block?: boolean; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare function texRef(id: string, tex: string): string;",
  "declare function lstset(options: { lang?: string; theme?: string; langs?: unknown; themes?: unknown[] }): void;",
  'declare function mathset(options: { macros?: Record<string, string>; output?: "mathml" | "html" | "htmlAndMathml" }): void;',
  "declare function secset(options: { numberDepth?: number }): void;",
  'declare function bibset(options: { src?: Record<string, { author?: string; title?: string; year?: string | number; url?: string }>; style?: "numeric" | "alpha" }): void;',
  ""
].join("\n");

/**
 * Build the full typing preamble text: the global JSX namespace + the structural, solid-js, and
 * prelude surfaces as module-local ambient declarations. Whole lines only.
 *
 * Called at **build time** by `scripts/gen-preamble.ts` (baked into `preamble.generated.ts`) and
 * by the `preamble-sync` drift test.
 */
export function buildPreamble(): string {
  // Coverage guard: every name the emit can reference free — the union of ALL FOUR canonical
  // compiler lists (structural `CORE_RUNTIME_NAMES`, `solid-js/web`'s `SOLID_WEB_NAMES`,
  // `solid-js`'s `SOLID_AMBIENT_NAMES`, and `AMBIENT_PRELUDE_NAMES`) — must have a typing
  // somewhere in the ambient body, so a name list growing without a preamble update fails
  // generation (and the preamble-sync test in CI) instead of silently surfacing "Cannot find
  // name" diagnostics. (A partial guard once missed `Attrs` exactly this way.)
  const ambientBody = AMBIENT_STRUCTURAL + AMBIENT_SOLID + AMBIENT_PRELUDE;
  const missing = [
    ...CORE_RUNTIME_NAMES,
    ...SOLID_WEB_NAMES,
    ...SOLID_AMBIENT_NAMES,
    ...AMBIENT_PRELUDE_NAMES
  ].filter(
    name =>
      !new RegExp(`^declare (const|function) ${name}\\b`, "m").test(ambientBody)
  );
  if (missing.length > 0) {
    throw new Error(
      `preamble-gen: ambient names missing a typing: ${missing.join(", ")} — ` +
        "add declarations in preamble-gen.ts"
    );
  }
  return JSX_NAMESPACE + ambientBody;
}
