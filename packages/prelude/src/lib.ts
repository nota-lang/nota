/**
 * Nota's ambient Solid components: prose structure, references, code, math, figures, and
 * positional configuration. A custom `preludeModule` can replace this surface site-wide.
 */

export {
  BASE_THEME_NAMES,
  CodeBlock,
  type CodeConfig,
  CodeInline,
  codeConfig,
  type LstsetOptions,
  loadedLangNames,
  lstset,
  resetCodeWarningsForTest
} from "./code";

export {
  Def,
  DefBank,
  installDefTooltipHandlers,
  resetDefTooltipHandlersForTest,
  texRef
} from "./def";
export {
  type BibConfig,
  type BibEntry,
  Bibliography,
  type BibsetOptions,
  bibConfig,
  bibset,
  Cite,
  Heading,
  Label,
  Note,
  Notes,
  NotesList,
  Ref,
  type SecConfig,
  type SecsetOptions,
  secConfig,
  secset,
  Title,
  Toc
} from "./doc-state";
export {
  Caption,
  FIGURE_KIND,
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
export { resetConfigForTest } from "./session-config";
export {
  type MathConfig,
  type MathsetOptions,
  mathConfig,
  mathset,
  Tex
} from "./tex";
