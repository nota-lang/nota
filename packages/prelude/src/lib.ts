/**
 * Nota's ambient Solid components: prose structure, references, code, math, figures, and
 * positional configuration. A custom `preludeModule` can replace this surface site-wide.
 */

export {
  BASE_THEME_NAMES,
  CodeBlock,
  CodeInline,
  loadedLangNames,
  resetCodeWarningsForTest
} from "./code";
export {
  type BibEntry,
  type BibsetOptions,
  bibset,
  config,
  type LstsetOptions,
  lstset,
  type MathsetOptions,
  mathset,
  type PreludeConfig,
  resetConfigForTest,
  type SecsetOptions,
  secset
} from "./config";
export {
  DEF_TOOLTIP_STYLE,
  Def,
  DefBank,
  installDefTooltipHandlers,
  resetDefTooltipHandlersForTest,
  texRef
} from "./def";
export {
  Bibliography,
  Cite,
  Heading,
  Label,
  Note,
  Notes,
  NotesList,
  Ref,
  Title,
  Toc
} from "./doc-state";
export {
  Caption,
  FIGURE_KIND,
  FIGURE_STYLE,
  Figure,
  Smallcaps,
  Subfigure
} from "./figure";
export {
  ANCHOR_KINDS,
  type AnchorFact,
  anchorKey,
  anchorOrdinals,
  anchorsOf,
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
