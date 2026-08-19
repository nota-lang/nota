/** Public CodeMirror support for Nota. */

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
  KIND_STYLES,
  type NotaSpan,
  notaHighlighting
} from "./nota-mode";
export { PALETTE } from "./palette";
