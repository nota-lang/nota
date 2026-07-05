/**
 * `@nota-lang/prelude` — the standard ambient prelude (contract R14).
 *
 * The reader emits `Tex` / `CodeInline` / `CodeBlock` as free identifiers; integrators bind them to
 * this package's exports (the CLI via esbuild `inject`, vite via its virtual prelude module). Each
 * is a **registry slot** over a shipped default:
 *
 * - `Tex` → {@link DefaultTex} — KaTeX → MathML (no CSS/fonts needed);
 * - `CodeInline` / `CodeBlock` → {@link DefaultCodeInline} / {@link DefaultCodeBlock} — sync shiki,
 *   armed `|@` parts as decorations.
 *
 * Override per-site at runtime with `registerComponents({ Tex: MyMath })` (re-exported here for
 * convenience — it is ambient-adjacent surface); override per-document by `%import`ing your own
 * binding, which lexically shadows the ambient one. A registered *plain function* stays fully
 * static under SSG; a registered `inlineComponent`/`blockComponent` becomes a hydration island —
 * both interact with SSG like any other component (R14b).
 *
 * Configure the defaults with {@link lstset} (listings-style: lang/theme/grammar extensions)
 * and {@link mathset} (KaTeX macros) — document-global, reset per render (R14d).
 *
 * The doc-state constructs (contract R18e/f — `Heading`/`Toc`/`Label`/`Ref`/footnotes/`Cite`/
 * `Bibliography`, config `secset`/`bibset`) live in {@link "./doc"} and are re-exported here; they
 * are the same slot-over-`mark`/`query` pattern. This module also registers the `"footnotes"`
 * trailer (R18d) at load, so the footnote list auto-appends at document end unless an explicit
 * `@Footnotes` placement suppresses it.
 */

import { h, query, registerTrailer, slot } from "@nota-lang/runtime";

import { DefaultCodeBlock, DefaultCodeInline } from "./code";
import { FootnotesList } from "./doc";
import { DefaultTex } from "./tex";

// --- the ambient bindings (registry slots over the shipped defaults) ---
export const Tex = slot("Tex", DefaultTex);
export const CodeInline = slot("CodeInline", DefaultCodeInline);
export const CodeBlock = slot("CodeBlock", DefaultCodeBlock);

// --- override surface (re-exported from the runtime so `% registerComponents({…})` is ambient) ---
export {
  clearRegisteredComponents,
  registerComponents
} from "@nota-lang/runtime";
// --- the shipped defaults (exported for composition/wrapping in user overrides) ---
export { DefaultCodeBlock, DefaultCodeInline } from "./code";

// --- configuration (R14d + R18e) ---
export {
  type BibEntry,
  type BibsetOptions,
  bakeConfigBaseline,
  bibset,
  type LstsetOptions,
  lstset,
  type MathsetOptions,
  mathset,
  resetConfigForTest,
  type SecsetOptions,
  secset
} from "./config";
// --- doc-state constructs (contract R18e/f): slots + shipped defaults + helpers ---
export {
  Bibliography,
  Cite,
  counters,
  DefaultBibliography,
  DefaultCite,
  DefaultFootnote,
  DefaultFootnoteMark,
  DefaultFootnotes,
  DefaultFootnotesList,
  DefaultFootnoteText,
  DefaultHeading,
  DefaultLabel,
  DefaultRef,
  DefaultToc,
  Footnote,
  FootnoteMark,
  Footnotes,
  FootnotesList,
  FootnoteText,
  Heading,
  Label,
  Ref,
  Toc,
  textContent
} from "./doc";
export { DefaultTex } from "./tex";

// --- R18d: auto-append the footnote list at document end (unless @Footnotes places it). The
//     trailer calls the `FootnotesList` *slot*, so a site override reaches this path too. ---
registerTrailer("footnotes", () =>
  query(doc =>
    doc.all("footnote").length > 0 && doc.all("footnotes-here").length === 0
      ? h(FootnotesList, {}, [])
      : null
  )
);
