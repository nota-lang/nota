/**
 * `@nota-lang/prelude` — the standard ambient prelude, Solid-native (design/solid.md §The
 * prelude).
 *
 * The reader's emit references these as free identifiers; the compiler shim binds them here
 * (or at the integrator's `preludeModule`). Every component is a **plain Solid component** —
 * the old registry slots are gone. Override site-wide by pointing `preludeModule` at a module
 * re-exporting your customized set; user-typed ambient names (`Toc`, `Cite`, the config fns)
 * can also be `%import`-shadowed per document, but the emit-referenced names (`Tex`,
 * `Heading`, …) are reserved — a document binding of those is a reader diagnostic.
 *
 * - `Tex` — KaTeX → MathML (no CSS/fonts needed); `mathset({output:"html"})` opts into HTML.
 * - `CodeInline` / `CodeBlock` — sync shiki (armed parts contribute text; decorations are a
 *   flagged v0 regression).
 * - The doc-state family (`Heading`/`Title`/`Toc`/`Label`/`Ref`/footnotes/`Cite`/
 *   `Bibliography`) — components over the `@nota-lang/core` doc-state store (registrations +
 *   derivations; the LaTeX-.aux two-pass model at SSG time, reactive on the client).
 * - `Definition`/`texRef` + the tooltip system — Solid components; the tooltip bank is a
 *   store-registered trailer whose handlers attach on hydration, and definition references
 *   degrade to real anchor jumps without JS.
 *
 * Configure with `lstset`/`mathset`/`secset`/`bibset` — **positional** now (document order),
 * see ./config.
 */

export {
  BASE_LANG_NAMES,
  BASE_THEME_NAMES,
  CodeBlock,
  CodeInline,
  resetCodeWarningsForTest
} from "./code";
export {
  type BibEntry,
  type BibsetOptions,
  bakeConfigBaseline,
  bibset,
  config,
  type LstsetOptions,
  lstset,
  type MathsetOptions,
  mathset,
  type PreludeConfig,
  resetConfig,
  resetConfigForTest,
  type SecsetOptions,
  secset
} from "./config";
export {
  DEF_TOOLTIP_STYLE,
  DefBank,
  Definition,
  installDefTooltipHandlers,
  resetDefTooltipHandlersForTest,
  texRef
} from "./def";
export {
  Bibliography,
  Cite,
  Footnote,
  Footnotes,
  FootnotesList,
  Heading,
  Label,
  Ref,
  Title,
  Toc
} from "./doc-state";
export {
  ANCHOR_KINDS,
  type AnchorFact,
  anchorKey,
  anchorOrdinals,
  anchorsOf,
  counters,
  FACT_KINDS,
  headingIds,
  headingNumbers,
  type RefFact,
  type ResolvedAnchor,
  refsTo,
  refTargetKey,
  resolveAnchors,
  slugify,
  useNumbers
} from "./refs";
export { Tex } from "./tex";
