/**
 * CM6 highlighting for the Nota editor (left pane) — **reader-driven**: the wasm reader's
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
 * While a document is mid-edit it frequently fails to parse; `highlight` then throws, and the
 * plugin keeps the last-good decorations mapped through the edit (`RangeSet.map`), so colors don't
 * flicker off between keystrokes.
 */

import { type Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from "@codemirror/view";
import { highlight, highlightKindNames } from "nota_wasm";

// Catppuccin Latte (light) — the same palette as highlight-style.ts (output panes) and the `--*`
// vars in playground.css, so the editor sits cohesively on the light theme.
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
  math: { color: green },
  code: { color: green },
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
  "js-operator": { color: teal }
};

/** The editor theme: one rule per kind, in {@link KIND_STYLES} (tie-breaking) order. */
const notaTheme: Extension = EditorView.baseTheme(
  Object.fromEntries(
    Object.entries(KIND_STYLES).map(([name, style]) => [`.cm-nota-${name}`, style])
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
 * One classified span, for tests and the dump-tokens debug CLI. `kind` is the reader's stable
 * kebab-case name. Requires the wasm compiler to be initialized (compiler.ts `ensureCompiler`).
 */
export interface NotaSpan {
  from: number;
  to: number;
  kind: string;
}

/** Highlight `source` → named spans (throws the reader's diagnostics on a parse error). */
export function highlightSpans(source: string): NotaSpan[] {
  const names = highlightKindNames();
  const triples = highlight(source);
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

/** Compute the decoration set for `doc`, or `null` when it doesn't parse (keep last-good). */
function computeDecorations(doc: string): DecorationSet | null {
  let triples: Uint32Array;
  try {
    triples = highlight(doc);
  } catch {
    return null;
  }
  const marks = decorationsForKinds();
  const builder = new RangeSetBuilder<Decoration>();
  // Triples are sorted start-ascending / end-descending — the order RangeSetBuilder requires,
  // with outer spans added before the spans they contain.
  for (let i = 0; i + 2 < triples.length; i += 3) {
    const from = triples[i];
    const to = triples[i + 1];
    const mark = marks[triples[i + 2]];
    if (mark && to > from && to <= doc.length) {
      builder.add(from, to, mark);
    }
  }
  return builder.finish();
}

/**
 * The CM6 extension: a ViewPlugin that re-highlights on every document change (the wasm parse is
 * sub-millisecond at document scale), plus the kind theme. Assumes the wasm compiler is loaded —
 * use {@link createNotaHighlight} to get the loading tied in.
 */
export function notaHighlighting(): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = computeDecorations(view.state.doc.toString()) ?? Decoration.none;
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
  return [plugin, notaTheme];
}

/** Convenience: load the wasm compiler (idempotent), then the highlighting extension. The
 *  compiler module is imported lazily so this file stays importable outside Vite (the dump-tokens
 *  CLI under tsx — compiler.ts's `?url` wasm import only resolves through Vite). */
export async function createNotaHighlight(): Promise<Extension> {
  const { ensureCompiler } = await import("./compiler");
  await ensureCompiler();
  return notaHighlighting();
}
