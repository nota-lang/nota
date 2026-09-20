/** Generate the resolution-independent ambient types prepended to virtual TSX. */

import {
  AMBIENT_PRELUDE_NAMES,
  CORE_RUNTIME_NAMES,
  SOLID_AMBIENT_NAMES,
  SOLID_WEB_NAMES
} from "@nota-lang/compiler";

/** Intrinsics with attributes more specific than the open fallback. */
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

/** `@nota-lang/core`'s structural components ({@link CORE_RUNTIME_NAMES}). */
const AMBIENT_STRUCTURAL = [
  "declare const NotaDoc: (props: { children?: unknown }) => unknown;",
  "declare const Reforest: (props: { children?: unknown; tight?: boolean }) => unknown;",
  "declare const UlLi: (props: { children?: unknown }) => unknown;",
  "declare const OlLi: (props: { children?: unknown }) => unknown;",
  "declare const Attrs: (props: Record<string, unknown>) => unknown;",
  ""
].join("\n");

/** `@solidjs/web`'s free names ({@link SOLID_WEB_NAMES}) — dynamic `@(expr)` tags. */
const AMBIENT_SOLID_WEB = [
  "declare const Dynamic: (props: { component: unknown; children?: unknown; [prop: string]: unknown }) => unknown;",
  ""
].join("\n");

/** Permissive Solid signatures in compiler-list order. Keep their shapes in sync with runtime APIs. */
const AMBIENT_SOLID = [
  "declare const createSignal: <T>(value: T, options?: { name?: string; equals?: false | ((prev: T, next: T) => boolean); ownedWrite?: boolean; unobserved?: () => void }) => [() => T, (v: T | ((prev: T) => T)) => T];",
  "declare const createMemo: <T>(compute: (prev?: T) => T, options?: { name?: string; id?: string; transparent?: boolean; equals?: false | ((prev: T, next: T) => boolean) }) => () => T;",
  "declare const createEffect: <T>(compute: (prev?: T) => T, effect: (value: T, prev?: T) => void | (() => void), options?: { name?: string; defer?: boolean }) => void;",
  "declare const createContext: <T>(defaultValue?: T, options?: { name?: string }) => { id: symbol; defaultValue: T | undefined; (props: { value: T; children?: unknown }): unknown };",
  "declare const useContext: <T>(context: { id: symbol; defaultValue: T | undefined }) => T;",
  "declare const createStore: <T extends object>(initialValue: T, options?: { name?: string; shallow?: boolean }) => [T, (fn: (draft: T) => T | void) => void];",
  "declare const untrack: <T>(fn: () => T, strictReadLabel?: string | false) => T;",
  "declare const flush: { (): void; <T>(fn: () => T): T };",
  "declare const onSettled: (fn: () => void | (() => void)) => void;",
  "declare const onCleanup: <T extends () => void>(fn: T) => T;",
  "declare const children: (fn: () => unknown) => { (): unknown; toArray(): unknown[] };",
  "declare const merge: (...sources: unknown[]) => Record<string, unknown>;",
  "declare const omit: <T extends Record<string, unknown>, K extends readonly (keyof T)[]>(props: T, ...keys: K) => Omit<T, K[number]>;",
  "declare const Show: <T>(props: { when: T | undefined | null | false; keyed?: boolean; fallback?: unknown; children?: unknown | ((item: () => T) => unknown) }) => unknown;",
  "declare const For: { <T>(props: { each: readonly T[] | undefined | null | false; fallback?: unknown; keyed?: true; children: (item: T, index: () => number) => unknown }): unknown; <T>(props: { each: readonly T[] | undefined | null | false; fallback?: unknown; keyed: false; children: (item: () => T, index: number) => unknown }): unknown };",
  "declare const Repeat: (props: { count: number; from?: number; fallback?: unknown; children: unknown | ((index: number) => unknown) }) => unknown;",
  "declare const Switch: (props: { fallback?: unknown; children?: unknown }) => unknown;",
  "declare const Match: <T>(props: { when: T | undefined | null | false; keyed?: boolean; children?: unknown }) => unknown;",
  "declare const Loading: (props: { fallback?: unknown; on?: unknown; children?: unknown }) => unknown;",
  "declare const Errored: (props: { fallback: unknown | ((err: () => unknown, reset: () => void) => unknown); children?: unknown }) => unknown;",
  ""
].join("\n");

const AMBIENT_PRELUDE = [
  "declare const CodeInline: (props: { children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const CodeBlock: (props: { lang?: string; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Tex: (props: { display?: boolean; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Heading: (props: { rank?: number; id?: string; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Toc: (props: { depth?: number; [prop: string]: unknown }) => unknown;",
  "declare const Label: (props: { id?: string; [prop: string]: unknown }) => unknown;",
  "declare const Ref: (props: { id?: string; page?: string; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Note: (props: { id?: string; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Notes: (props: { [prop: string]: unknown }) => unknown;",
  "declare const NotesList: (props: { [prop: string]: unknown }) => unknown;",
  "declare const Cite: (props: { children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Bibliography: (props: { [prop: string]: unknown }) => unknown;",
  "declare const Title: (props: { children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Def: (props: { id: string; Label?: () => unknown; tooltip?: unknown; block?: boolean; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Figure: (props: { id?: string; children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Subfigure: (props: { children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Caption: (props: { children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare const Smallcaps: (props: { children?: unknown; [prop: string]: unknown }) => unknown;",
  "declare function texRef(id: string, tex: string): string;",
  "declare function lstset(options: { lang?: string; theme?: string; langs?: unknown; themes?: unknown[] }): void;",
  'declare function mathset(options: { macros?: Record<string, string>; output?: "mathml" | "html" | "htmlAndMathml" }): void;',
  "declare function secset(options: { numberDepth?: number }): void;",
  'declare function bibset(options: { src?: Record<string, { author?: string; title?: string; year?: string | number; url?: string }>; style?: "numeric" | "alpha" }): void;',
  ""
].join("\n");

/** The union of the compiler's four canonical free-name lists, in preamble order. */
const CANONICAL_AMBIENT_NAMES: readonly string[] = [
  ...CORE_RUNTIME_NAMES,
  ...SOLID_WEB_NAMES,
  ...SOLID_AMBIENT_NAMES,
  ...AMBIENT_PRELUDE_NAMES
];

/** Build the global JSX and ambient runtime declarations as whole lines. */
export function buildPreamble(): string {
  const ambientBody =
    AMBIENT_STRUCTURAL + AMBIENT_SOLID_WEB + AMBIENT_SOLID + AMBIENT_PRELUDE;
  const declared = [
    ...ambientBody.matchAll(/^declare (?:const|function) (\w+)/gm)
  ].map(m => m[1]);

  const missing = CANONICAL_AMBIENT_NAMES.filter(
    name => !declared.includes(name)
  );
  if (missing.length > 0) {
    throw new Error(
      `preamble-gen: ambient names missing a typing: ${missing.join(", ")} — ` +
        "add declarations in preamble-gen.ts"
    );
  }
  // Reject stale declarations for names no longer available at runtime.
  const extra = declared.filter(
    name => !CANONICAL_AMBIENT_NAMES.includes(name)
  );
  if (extra.length > 0) {
    throw new Error(
      `preamble-gen: declarations for names outside the emit surface: ${extra.join(", ")} — ` +
        "remove them from preamble-gen.ts"
    );
  }
  return JSX_NAMESPACE + ambientBody;
}
