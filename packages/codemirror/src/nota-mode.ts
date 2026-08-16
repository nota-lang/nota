/**
 * CM6 highlighting for Nota — **reader-driven**: the wasm reader's
 * `highlight(source)` entry (an AST walk + embedded-JS re-lex inside the reader, `oxc_parser`)
 * returns classified `[start, end, kind]` span triples, and a small `ViewPlugin` paints each as a
 * `Decoration.mark` with a `cm-nota-<kind>` class themed on the Catppuccin-Latte palette below.
 *
 * This replaced the TextMate-grammar-through-Shiki bridge: the grammar is regex-only and cannot
 * track Nota's context-sensitivity or markup⇄JS mutual nesting, so a markup-valued prop
 * (`@figure[cap: @em{…}]`) or a stray `[` in prose derailed highlighting for the rest of the
 * document (see `integration/mega.nota`, the regression fixture). The reader-driven spans cannot
 * drift from the language — same parser, same parse.
 *
 * Spans arrive sorted start-ascending / end-descending: an *outer* span (a heading's whole-line
 * under-layer) precedes the spans it contains. CM6 merges overlapping marks by combining their
 * classes on the split text runs, so the theme below lists under-layer rules first and overlay
 * rules after them — for equal specificity, the later rule wins the tie.
 *
 * The reader paints a code/math *interior* as one flat kind (`code`/`math`); this module additionally
 * sub-tokenizes those interiors by their language — math is always TeX, a fenced code block uses its
 * info-string language — via CodeMirror's own Lezer/stream parsers (embedded-langs.ts), coloring the
 * tokens through the shared Catppuccin `HighlightStyle` (highlight-style.ts). A tokenized interior
 * replaces its flat paint; an unknown language / inline code keeps the flat under-layer.
 *
 * While a document is mid-edit it frequently fails to parse; `highlight` then throws, and the
 * plugin keeps the last-good decorations mapped through the edit (`RangeSet.map`), so colors don't
 * flicker off between keystrokes.
 */

import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from "@codemirror/view";
import { highlight, highlightKindNames } from "@nota-lang/compiler/reader";
import { embeddedTokens } from "./embedded-langs";
import { catppuccinHighlight } from "./highlight-style";

// ---------------------------------------------------------------------------------------------
// Offset units: the reader speaks UTF-8 bytes; CodeMirror (and JS strings) speak UTF-16
// ---------------------------------------------------------------------------------------------

/**
 * Byte-offset → UTF-16-offset lookup for `doc`, or `null` when the two coincide (ASCII-only —
 * the common case, kept allocation-free). Index `map[byte]` = the UTF-16 offset of the character
 * containing that byte; `map[byteLength]` = `doc.length`. The reader never emits a span boundary
 * mid-character, so the mid-byte entries are never read — they're filled anyway (floor semantics)
 * so a bug upstream degrades to off-by-a-character rather than garbage.
 */
function byteToUtf16(doc: string): Uint32Array | null {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the ASCII fast-path test.
  if (!/[^\x00-\x7f]/.test(doc)) return null;
  let byteLength = 0;
  for (const ch of doc) {
    const cp = ch.codePointAt(0) as number;
    byteLength += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  const map = new Uint32Array(byteLength + 1);
  let b = 0;
  let u = 0;
  for (const ch of doc) {
    const cp = ch.codePointAt(0) as number;
    const bytes = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    for (let k = 0; k < bytes; k++) {
      map[b + k] = u;
    }
    b += bytes;
    u += ch.length;
  }
  map[b] = u;
  return map;
}

/**
 * The reader's `highlight(doc)` triples with offsets **converted to UTF-16** — every consumer in
 * this module indexes JS strings and CM positions, so the conversion happens once, here, at the
 * wasm boundary. (Skipping it made every span after the first non-ASCII character drift right —
 * an `&ref` after an em-dash highlighted as `&no` + `ta…`.)
 */
function highlightUtf16(doc: string): Uint32Array {
  const triples = highlight(doc);
  const map = byteToUtf16(doc);
  if (!map) return triples;
  const out = new Uint32Array(triples.length);
  for (let i = 0; i + 2 < triples.length; i += 3) {
    out[i] = map[Math.min(triples[i], map.length - 1)];
    out[i + 1] = map[Math.min(triples[i + 1], map.length - 1)];
    out[i + 2] = triples[i + 2];
  }
  return out;
}

// Catppuccin Latte (light) — the same palette as highlight-style.ts, so a Nota editor sits
// cohesively beside consumers' other CM panes on a light theme.
const teal = "#179299";
const blue = "#1e66f5";
const yellow = "#df8e1d";
const lavender = "#7287fd";
const maroon = "#e64553";
const mauve = "#8839ef";
const red = "#d20f39";
const green = "#40a02b";
const peach = "#fe640b";
const pink = "#ea76cb";
const overlay = "#7c7f93";
const muted = "#8c8fa1";

/**
 * Kind-name → CSS style, keyed by the reader's stable kebab-case kind names
 * (`highlightKindNames()`). Ordered under-layers → overlays: CM6 puts BOTH classes on a text run
 * where spans overlap, and with equal specificity the *later* stylesheet rule wins — so `sigil`
 * must come after `heading` for the `@`/`#` bytes inside a heading to read as markers.
 */
const KIND_STYLES: Record<string, Record<string, string>> = {
  // Under-layers (whole-construct spans that children overlay).
  heading: { color: red, fontWeight: "700" },
  "emphasis-strong": { fontWeight: "700" },
  "emphasis-em": { fontStyle: "italic" },
  "emphasis-strike": { textDecoration: "line-through" },
  // `math`/`code`/`style-text` are the flat fallback (verbatim always): an interior with a known
  // language is overlaid by embedded sub-language tokens (embedded-langs.ts), which replace this
  // paint. `style-text` is a `@style{…}` body (always CSS, so overlaid unless empty).
  math: { color: green },
  code: { color: green },
  "style-text": { color: green },
  verbatim: { color: green },
  // Overlays.
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
  comment: { color: muted, fontStyle: "italic" },
  "link-url": { color: blue, textDecoration: "underline" }
};

/** The editor theme: one rule per kind, in {@link KIND_STYLES} (tie-breaking) order. */
const notaTheme: Extension = EditorView.baseTheme(
  Object.fromEntries(
    Object.entries(KIND_STYLES).map(([name, style]) => [
      `.cm-nota-${name}`,
      style
    ])
  )
);

/** `Decoration.mark`s indexed by kind discriminant (the third value of each wasm triple). */
let kindDecorations: Decoration[] | null = null;

function decorationsForKinds(): Decoration[] {
  if (!kindDecorations) {
    kindDecorations = highlightKindNames().map(name =>
      Decoration.mark({ class: `cm-nota-${name}` })
    );
  }
  return kindDecorations;
}

/**
 * One classified span, for tests and debug tooling (the playground's dump-tokens CLI). `kind` is the
 * reader's stable kebab-case name. Requires `nota_wasm` to be initialized.
 */
export interface NotaSpan {
  from: number;
  to: number;
  kind: string;
}

/** Highlight `source` → named spans (throws the reader's diagnostics on a parse error). */
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

/** One code/math interior to sub-tokenize, with its resolved language (math → `"tex"`). */
export interface EmbeddedRegion {
  from: number;
  to: number;
  lang: string | null;
}

/**
 * The reader's `code`/`math` raw-run spans, each tagged with the language to tokenize it as. Math is
 * always TeX; a `code` run's language is the fence's `code-lang` token. Because the reader emits an
 * open `code-delim` → `code-lang` → `code` runs → close `code-delim` (and inline code has no
 * `code-lang`), a reset-on-delim / set-on-lang / apply-on-run walk recovers each run's language —
 * inline and untagged fences resolve to `null` and are left flat by the caller. A `style-text` run
 * (a `@style{…}` element body — the reader marks it) is always CSS.
 */
function embeddedRegionsOf(
  doc: string,
  triples: Uint32Array,
  names: string[]
): EmbeddedRegion[] {
  const regions: EmbeddedRegion[] = [];
  let pendingLang: string | null = null;
  // A `@style{…}` body is split into text children at its literal braces, so it arrives as several
  // `style-text` runs — coalesce adjacent (offset-contiguous) ones so the CSS is tokenized as one
  // string, `.a { color: red }` not `.a `/`{`/…. A hole (interpolation) breaks contiguity and splits
  // the region, like a code/math armed form.
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

/**
 * The code/math interiors of `doc` with their resolved languages ({@link embeddedRegionsOf} over a
 * fresh parse). Exported for the dump-tokens CLI; returns `[]` when the document doesn't parse.
 */
export function embeddedRegions(doc: string): EmbeddedRegion[] {
  try {
    return embeddedRegionsOf(doc, highlightUtf16(doc), highlightKindNames());
  } catch {
    return [];
  }
}

/** One embedded sub-language token: absolute source offsets + its Catppuccin `HighlightStyle` class. */
export interface EmbeddedSpan {
  from: number;
  to: number;
  classes: string;
}

/**
 * The embedded sub-language tokens for `doc` (absolute offsets) — code/math interiors tokenized by
 * their language and colored through {@link catppuccinHighlight}'s style. These overlay (replacing)
 * the reader's flat `code`/`math` paint in {@link computeDecorations}. Exported for tests / the
 * dump-tokens CLI; returns `[]` when the document doesn't parse.
 */
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

  // Overlay each code/math/style region's interior with its sub-language tokens. A region that
  // tokenizes records its extent in `tokenized`, so the reader's flat `code`/`math`/`style-text` paint
  // is dropped across it below; an unknown language / empty result leaves the flat paint (fallback).
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
  // Is `from` inside a tokenized region? Regions are disjoint; a coalesced style region can span
  // several `style-text` triples, so match by extent, not start offset.
  const isTokenized = (from: number) =>
    tokenized.some(r => from >= r.from && from < r.to);

  // Reader marks, dropping the flat paint where an overlay covers it. `Decoration.set` sorts the mix
  // (overlays nest inside their region, out of the reader's start-ascending order); overlap resolution
  // stays CSS-order based (the theme below), unchanged.
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
      continue; // tokenized: overlay tokens already added; drop the flat under-layer
    }
    const mark = marks[kindIndex];
    if (mark) ranges.push(mark.range(from, to));
  }
  return Decoration.set(ranges, true);
}

/**
 * The CM6 extension: a ViewPlugin that re-highlights on every document change (the wasm parse is
 * sub-millisecond at document scale), plus the kind theme. Assumes `nota_wasm` is initialized —
 * the consumer awaits its `init` before installing the extension.
 */
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
        // Mid-edit parse error: keep the last-good spans, repositioned through the edit.
        this.decorations = next ?? this.decorations.map(update.changes);
      }
    },
    { decorations: plugin => plugin.decorations }
  );
  // `catppuccinHighlight` injects the shared `HighlightStyle`'s stylesheet so the embedded
  // sub-language overlay classes (from `embeddedTokens` via `highlightTree`) resolve to colors. It
  // registers a tree highlighter too, but the editor has no CM `Language`, so nothing auto-paints.
  return [plugin, notaTheme, catppuccinHighlight];
}
