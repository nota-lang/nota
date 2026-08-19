/** Reader-driven CodeMirror highlighting with embedded code/math tokenization. */

import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from "@codemirror/view";
import { makeByteConverter } from "@nota-lang/compiler/offsets";
import { highlight, highlightKindNames } from "@nota-lang/compiler/reader";
import { embeddedTokens } from "./embedded-langs";
import { catppuccinHighlight } from "./highlight-style";
import { PALETTE } from "./palette";

/** Return reader highlight triples in CodeMirror's UTF-16 offset space. */
function highlightUtf16(doc: string): Uint32Array {
  const triples = highlight(doc);
  const offsets = makeByteConverter(doc);
  const out = new Uint32Array(triples.length);
  for (let i = 0; i + 2 < triples.length; i += 3) {
    out[i] = offsets.toUtf16(triples[i]);
    out[i + 1] = offsets.toUtf16(triples[i + 1]);
    out[i + 2] = triples[i + 2];
  }
  return out;
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

let kindDecorations: Decoration[] | null = null;

function decorationsForKinds(): Decoration[] {
  if (!kindDecorations) {
    kindDecorations = highlightKindNames().map(name =>
      Decoration.mark({ class: `cm-nota-${name}` })
    );
  }
  return kindDecorations;
}

export interface NotaSpan {
  from: number;
  to: number;
  kind: string;
}

/** Highlight `source` into named UTF-16 spans. */
export function highlightSpans(source: string): NotaSpan[] {
  const names = highlightKindNames();
  const triples = highlightUtf16(source);
  const spans: NotaSpan[] = [];
  for (let i = 0; i + 2 < triples.length; i += 3) {
    spans.push({
      from: triples[i],
      to: triples[i + 1],
      kind: names[triples[i + 2]] ?? `unknown-${triples[i + 2]}`
    });
  }
  return spans;
}

export interface EmbeddedRegion {
  from: number;
  to: number;
  lang: string | null;
}

/** Recover embedded languages from the reader's ordered delimiter/language/content spans. */
function embeddedRegionsOf(
  doc: string,
  triples: Uint32Array,
  names: string[]
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
  for (let i = 0; i + 2 < triples.length; i += 3) {
    const from = triples[i];
    const to = triples[i + 1];
    const kind = names[triples[i + 2]];
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
    return embeddedRegionsOf(doc, highlightUtf16(doc), highlightKindNames());
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
  let triples: Uint32Array;
  try {
    triples = highlightUtf16(doc);
  } catch {
    return [];
  }
  const names = highlightKindNames();
  const spans: EmbeddedSpan[] = [];
  for (const region of embeddedRegionsOf(doc, triples, names)) {
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
  let triples: Uint32Array;
  try {
    triples = highlightUtf16(doc);
  } catch {
    return null;
  }
  const names = highlightKindNames();
  const marks = decorationsForKinds();
  const ranges: Range<Decoration>[] = [];

  const tokenized: EmbeddedRegion[] = [];
  for (const region of embeddedRegionsOf(doc, triples, names)) {
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

  for (let i = 0; i + 2 < triples.length; i += 3) {
    const from = triples[i];
    const to = triples[i + 1];
    const kindIndex = triples[i + 2];
    if (!(to > from && to <= doc.length)) continue;
    const kind = names[kindIndex];
    if (
      (kind === "code" || kind === "math" || kind === "style-text") &&
      isTokenized(from)
    ) {
      continue;
    }
    const mark = marks[kindIndex];
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
