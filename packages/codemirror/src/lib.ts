/**
 * `@nota-lang/codemirror` — CodeMirror 6 language support for Nota, **reader-driven**: no CM grammar
 * exists for Nota; the wasm reader's `highlight()` span triples are painted as decorations
 * (nota-mode.ts), code/math/`@style` interiors are sub-tokenized with CM's own parsers
 * (embedded-langs.ts), and both layers color through one Catppuccin-Latte `HighlightStyle`
 * (highlight-style.ts).
 *
 * The wasm reader (`@nota-lang/wasm`) instantiates when the module graph loads — no init step;
 * {@link notaHighlighting} is usable as soon as the import resolves.
 */

export {
  type EmbeddedToken,
  embeddedTokens,
  languageFor
} from "./embedded-langs";
export { catppuccinHighlight, catppuccinLatte } from "./highlight-style";
export {
  type EmbeddedRegion,
  type EmbeddedSpan,
  embeddedHighlightSpans,
  embeddedRegions,
  highlightSpans,
  type NotaSpan,
  notaHighlighting
} from "./nota-mode";
