/**
 * The **typing preamble** prepended to every virtual `.tsx`.
 *
 * The reader's `compileVirtual` emits a *bare* `.tsx` — it deliberately omits the
 * `@nota-lang/runtime` import (the reader does not emit it; the integrator prepends it) **and** the
 * ambient prelude bindings the emit references as free identifiers (`useState`, and the whole prelude
 * surface — `CodeInline`/`CodeBlock`/`Tex`/`Heading` + the `Label`/`Ref`/footnote/`Cite`/… doc-state
 * family, R20c). For the TS language service to type-check the
 * virtual module (so `h`/`decode`/`Fragment`/component refs resolve and `@Unknown{}` →
 * "Cannot find name 'Unknown'" rather than a cascade of phantom errors), the language server
 * prepends this preamble.
 *
 * **The preamble-shift rule.** Prepending text to `code` pushes every generated offset forward by
 * `PREAMBLE.length` bytes. The reader's `generatedOffsets` index the *bare* `.tsx`; after the
 * prepend they must be shifted by `PREAMBLE.length`. `sourceOffsets` index the `.nota` and are
 * **unchanged** (the source is untouched). {@link shiftMappings} performs exactly this.
 *
 * The preamble is authored to occupy **whole lines only** and never to be the target of a mapping,
 * so the shift is a pure additive constant — no mapping ever points *into* the preamble.
 */

/**
 * The runtime import the reader omits — byte-identical to
 * `@nota-lang/compiler`'s `RUNTIME_IMPORT`. Brings `h` / `decode` / `Fragment` /
 * `inlineComponent` / `blockComponent` into scope with their shipped `.d.ts` types.
 */
const RUNTIME_IMPORT =
  'import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime";\n';

/**
 * Ambient declarations for the free identifiers the emit references that are *not* from the runtime
 * import:
 *
 * - `useState` — the framework hook the integrator supplies (the canonical golden's
 *   `%let Colorized = inlineComponent((children) => { let [c, setC] = useState("red"); … })`
 *   references it as a free identifier). Typed as the React-shaped hook so destructuring + the
 *   setter type-check.
 * - `CodeInline` / `CodeBlock` / `Tex` / `Heading` + the doc-state family `Toc` / `Label` / `Ref` /
 *   `Footnote` / `FootnoteMark` / `FootnoteText` / `Footnotes` / `FootnotesList` / `Cite` /
 *   `Bibliography` — the prelude *component slots* (`` `@x` `` → `h(CodeInline, …)`, fenced code →
 *   `h(CodeBlock, …)`, `$…$` → `h(Tex, …)`; contract R14 — plus `# Title` → `h(Heading, { rank }, …)`
 *   heading sugar, R18f, and the `<x>` / `&x` / `[^x]` / `[^x]:` doc-state sugar → `h(Label|Ref|…, …)`,
 *   R20a; the whole family is ambient per R20c). Typed as plain function tags over **index-typed
 *   props**: the runtime's `TemplateFn` takes `CompProps` (whose fields are `unknown` via its index
 *   signature), so a narrowed prop type (`display?: boolean`, `rank: number`) would fail the
 *   contravariant tag-assignability check at every `h(Tex, …)` / `h(Heading, …)` call site — hence the
 *   index signature here even though `Heading` semantically takes `{ rank; id? }`. (`Tex`, not `Math` —
 *   R14: an ambient `Math` would shadow the JS global, breaking `Math.floor` in embedded code.)
 * - `lstset` / `mathset` / `secset` / `bibset` / `registerComponents` — the prelude's config +
 *   override surface (R14b/d, R18e; the config fns joined the ambient set in R20c), ambient so
 *   `% lstset({ lang: "python" })` / `% secset({ numbering: "1.1" })` type-check in embedded code.
 *
 * `declare` + ambient `const`/`function` ⇒ no runtime footprint; this is types-only.
 */
const SLOT = "(props: { [prop: string]: unknown }) => unknown";
const AMBIENT_PRELUDE =
  "declare const useState: <T>(init: T) => [T, (v: T) => void];\n" +
  `declare const CodeInline: ${SLOT};\n` +
  `declare const CodeBlock: ${SLOT};\n` +
  `declare const Tex: ${SLOT};\n` +
  `declare const Heading: ${SLOT};\n` +
  `declare const Toc: ${SLOT};\n` +
  `declare const Label: ${SLOT};\n` +
  `declare const Ref: ${SLOT};\n` +
  `declare const Footnote: ${SLOT};\n` +
  `declare const FootnoteMark: ${SLOT};\n` +
  `declare const FootnoteText: ${SLOT};\n` +
  `declare const Footnotes: ${SLOT};\n` +
  `declare const FootnotesList: ${SLOT};\n` +
  `declare const Cite: ${SLOT};\n` +
  `declare const Bibliography: ${SLOT};\n` +
  "declare function lstset(options: { lang?: string; theme?: string; langs?: unknown; themes?: unknown[] }): void;\n" +
  "declare function mathset(options: { macros?: Record<string, string> }): void;\n" +
  "declare function secset(options: { [k: string]: unknown }): void;\n" +
  "declare function bibset(options: { [k: string]: unknown }): void;\n" +
  "declare function registerComponents(components: Record<string, unknown>): void;\n";

/**
 * The full preamble prepended to the bare virtual `.tsx`. Whole lines only (every line ends in
 * `\n`), so it never overlaps a mapped generated range and the shift stays a clean constant.
 */
export const PREAMBLE = RUNTIME_IMPORT + AMBIENT_PRELUDE;

/** The byte length every `generatedOffsets` entry is shifted by. */
export const PREAMBLE_LENGTH = PREAMBLE.length;
