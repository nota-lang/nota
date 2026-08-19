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

/** Build the global JSX and ambient runtime declarations as whole lines. */
export function buildPreamble(): string {
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
