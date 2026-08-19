/** Reader-driven CodeMirror highlighting with embedded code/math tokenization. */

import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from "@codemirror/view";
import { analyze, highlightKindNames } from "@nota-lang/compiler";
import { makeByteConverter } from "@nota-lang/compiler/offsets";
import { embeddedTokens } from "./embedded-langs";
import { catppuccinHighlight } from "./highlight-style";
import { PALETTE } from "./palette";

export interface NotaSpan {
  from: number;
  to: number;
  kind: string;
}

/** Return reader highlights in CodeMirror's UTF-16 offset space. */
function highlightUtf16(doc: string): NotaSpan[] {
  const offsets = makeByteConverter(doc);
  return analyze(doc).highlights.map(span => ({
    from: offsets.toUtf16(span.start),
    to: offsets.toUtf16(span.end),
    kind: span.kind
  }));
}

const {
  teal,
  blue,
  yellow,
  lavender,
  maroon,
  mauve,
  red,
  green,
  peach,
  pink,
  overlay,
  muted
} = PALETTE;

/** Reader kind styles, ordered from under-layers to overlays for CSS tie-breaking. */
export const KIND_STYLES: Record<string, Record<string, string>> = {
  heading: { color: red, fontWeight: "700" },
  "emphasis-strong": { fontWeight: "700" },
  "emphasis-em": { fontStyle: "italic" },
  "emphasis-strike": { textDecoration: "line-through" },
  // Flat fallbacks for regions that cannot be sub-tokenized.
  math: { color: green },
  code: { color: green },
  "style-text": { color: green },
  verbatim: { color: green },
  sigil: { color: teal },
  "tag-host": { color: blue },
  "tag-component": { color: yellow },
  "prop-name": { color: lavender },
  interpolation: { color: maroon },
  "control-keyword": { color: mauve },
  "heading-marker": { color: red },
  "list-marker": { color: teal },
  "math-delim": { color: overlay },
  "code-delim": { color: overlay },
  "code-lang": { color: blue },
  escape: { color: pink },
  "js-keyword": { color: mauve },
  "js-string": { color: green },
  "js-number": { color: peach },
  "js-comment": { color: muted, fontStyle: "italic" },
  "js-operator": { color: teal },
  comment: { color: muted, fontStyle: "italic" }
};

const notaTheme: Extension = EditorView.baseTheme(
  Object.fromEntries(
    Object.entries(KIND_STYLES).map(([name, style]) => [
      `.cm-nota-${name}`,
      style
    ])
  )
);

let kindDecorations: Map<string, Decoration> | null = null;

function decorationsForKinds(): Map<string, Decoration> {
  if (!kindDecorations) {
    kindDecorations = new Map(
      highlightKindNames().map(name => [
        name,
        Decoration.mark({ class: `cm-nota-${name}` })
      ])
    );
  }
  return kindDecorations;
}

/** Highlight `source` into named UTF-16 spans. */
export function highlightSpans(source: string): NotaSpan[] {
  return highlightUtf16(source);
}

export interface EmbeddedRegion {
  from: number;
  to: number;
  lang: string | null;
}

/** Recover embedded languages from the reader's ordered delimiter/language/content spans. */
function embeddedRegionsOf(
  doc: string,
  spans: readonly NotaSpan[]
): EmbeddedRegion[] {
  const regions: EmbeddedRegion[] = [];
  let pendingLang: string | null = null;
  // Coalesce adjacent style-text runs; an interpolation leaves a gap and splits them.
  let style: { from: number; to: number } | null = null;
  const flushStyle = () => {
    if (style) {
      regions.push({ ...style, lang: "css" });
      style = null;
    }
  };
  for (const { from, to, kind } of spans) {
    if (kind === "style-text") {
      if (style && style.to === from) style.to = to;
      else {
        flushStyle();
        style = { from, to };
      }
      continue;
    }
    switch (kind) {
      case "code-delim":
        pendingLang = null;
        break;
      case "code-lang":
        pendingLang = doc.slice(from, to);
        break;
      case "code":
        regions.push({ from, to, lang: pendingLang });
        break;
      case "math":
        regions.push({ from, to, lang: "tex" });
        break;
    }
  }
  flushStyle();
  return regions;
}

/** Return embedded regions, or an empty list while the document does not parse. */
export function embeddedRegions(doc: string): EmbeddedRegion[] {
  try {
    return embeddedRegionsOf(doc, highlightUtf16(doc));
  } catch {
    return [];
  }
}

export interface EmbeddedSpan {
  from: number;
  to: number;
  classes: string;
}

/** Tokenize embedded regions into absolute source spans. */
export function embeddedHighlightSpans(doc: string): EmbeddedSpan[] {
  let highlights: NotaSpan[];
  try {
    highlights = highlightUtf16(doc);
  } catch {
    return [];
  }
  const spans: EmbeddedSpan[] = [];
  for (const region of embeddedRegionsOf(doc, highlights)) {
    for (const token of embeddedTokens(
      doc.slice(region.from, region.to),
      region.lang
    )) {
      spans.push({
        from: region.from + token.from,
        to: region.from + token.to,
        classes: token.classes
      });
    }
  }
  return spans;
}

/** Compute the decoration set for `doc`, or `null` when it doesn't parse (keep last-good). */
function computeDecorations(doc: string): DecorationSet | null {
  let highlights: NotaSpan[];
  try {
    highlights = highlightUtf16(doc);
  } catch {
    return null;
  }
  const marks = decorationsForKinds();
  const ranges: Range<Decoration>[] = [];

  const tokenized: EmbeddedRegion[] = [];
  for (const region of embeddedRegionsOf(doc, highlights)) {
    const tokens = embeddedTokens(
      doc.slice(region.from, region.to),
      region.lang
    );
    if (tokens.length === 0) continue;
    tokenized.push(region);
    for (const token of tokens) {
      const from = region.from + token.from;
      const to = region.from + token.to;
      if (to > from && to <= doc.length) {
        ranges.push(Decoration.mark({ class: token.classes }).range(from, to));
      }
    }
  }
  const isTokenized = (from: number) =>
    tokenized.some(r => from >= r.from && from < r.to);

  for (const { from, to, kind } of highlights) {
    if (!(to > from && to <= doc.length)) continue;
    if (
      (kind === "code" || kind === "math" || kind === "style-text") &&
      isTokenized(from)
    ) {
      continue;
    }
    const mark = marks.get(kind);
    if (mark) ranges.push(mark.range(from, to));
  }
  return Decoration.set(ranges, true);
}

/** CodeMirror extension for reader-driven Nota highlighting. */
export function notaHighlighting(): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations =
          computeDecorations(view.state.doc.toString()) ?? Decoration.none;
      }
      update(update: ViewUpdate) {
        if (!update.docChanged) return;
        const next = computeDecorations(update.state.doc.toString());
        this.decorations = next ?? this.decorations.map(update.changes);
      }
    },
    { decorations: plugin => plugin.decorations }
  );
  return [plugin, notaTheme, catppuccinHighlight];
}
