/**
 * CM6 highlighting for the Nota editor (left pane) — Option B: run the project's *own* TextMate
 * grammar (`vscode-nota/syntaxes/nota.tmLanguage.json`, scope `source.nota`) through Shiki, so the
 * playground highlights identically to the VSCode extension from a single source of truth, and the
 * embedded host code (TS/JS/JSON in `%` lines, `[props]`, `{expr}`, ``` fences) is colored by Shiki's
 * bundled grammars for free.
 *
 * There's no published shiki↔CM6 integration, so the bridge is a tiny `ViewPlugin`: Shiki tokenizes
 * the whole document (its `ThemedToken.offset` is absolute, so it maps straight to CM positions) and
 * we paint each token as a `Decoration.mark` with an inline color/font-style from the
 * `catppuccin-latte` theme (whose hues are the playground's `--*` palette). Shiki + the onig-wasm and
 * grammars load via dynamic `import()`, so they stay off the initial bundle; until the highlighter
 * resolves the editor simply shows plain text (see {@link App} wiring it in through a Compartment).
 */

import { type Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate
} from "@codemirror/view";

/** The slice of Shiki's tokenizer output the bridge consumes. */
interface ThemedToken {
  content: string;
  /** Offset from the start of the whole input — i.e. a CM document position. */
  offset: number;
  color?: string;
  /** Bitfield: 1=italic, 2=bold, 4=underline (Shiki's `FontStyle`). */
  fontStyle?: number;
}
export interface NotaHighlighter {
  codeToTokens(
    code: string,
    options: { lang: string; theme: string }
  ): { tokens: ThemedToken[][] };
}

/** The Shiki language id (the Nota grammar registers under this name) and theme. Exported so tests
 *  tokenize with the exact theme the bridge paints with. `catppuccin-latte` is the light variant. */
export const NOTA_LANG = "nota";
export const NOTA_THEME = "catppuccin-latte";
const ITALIC = 1;
const BOLD = 2;
const UNDERLINE = 4;

/**
 * catppuccin-latte enumerates its heading and list-marker colors per source language
 * (`markup.heading.atx.1.mdx`, `heading.1.markdown`, `markup.list.bullet`, …) and ships no generic
 * `markup.heading` / `markup.list` rule. So the Nota grammar's `markup.heading.nota` and
 * `markup.list.*.nota` scopes match nothing and render in the default text color. We add the missing
 * rules here, reusing the theme's own palette (red `#d20f39` for headings — same hue as its Typst
 * heading; teal `#179299` for list markers — same as `markup.list.bullet`). Most VSCode themes color
 * `markup.heading` generically, so the extension doesn't need this; it's purely a gap in this theme.
 */
const NOTA_THEME_RULES = [
  {
    scope: "markup.heading.nota",
    settings: { foreground: "#d20f39", fontStyle: "bold" }
  },
  {
    scope: ["markup.list.unnumbered.nota", "markup.list.numbered.nota"],
    settings: { foreground: "#179299" }
  }
];

/** Append {@link NOTA_THEME_RULES} to a loaded Shiki theme, writing back to whichever key holds the
 *  TextMate rules (`settings` or `tokenColors`). The new scopes don't overlap existing rules. */
function augmentTheme(theme: Record<string, unknown>): Record<string, unknown> {
  const key = Array.isArray(theme.tokenColors) ? "tokenColors" : "settings";
  const rules = Array.isArray(theme[key]) ? (theme[key] as unknown[]) : [];
  return { ...theme, [key]: [...rules, ...NOTA_THEME_RULES] };
}

/**
 * Build the Shiki highlighter: the Nota grammar (renamed to `nota`) over the catppuccin-latte theme,
 * with typescript/javascript/json loaded so the grammar's `source.ts|js|json` embeds resolve by scope.
 */
export async function createNotaHighlighter(): Promise<NotaHighlighter> {
  const [core, oniguruma, grammar, theme] = await Promise.all([
    import("shiki/core"),
    import("shiki/engine/oniguruma"),
    import("vscode-nota/syntaxes/nota.tmLanguage.json"),
    import("shiki/themes/catppuccin-latte.mjs")
  ]);
  const nota = { ...(grammar.default as object), name: NOTA_LANG };
  const highlighter = await core.createHighlighterCore({
    themes: [augmentTheme(theme.default as unknown as Record<string, unknown>)],
    langs: [
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/json.mjs"),
      nota
    ] as Parameters<typeof core.createHighlighterCore>[0]["langs"],
    engine: oniguruma.createOnigurumaEngine(import("shiki/wasm"))
  });
  return highlighter as unknown as NotaHighlighter;
}

/** Tokenize the whole doc and turn each colored token into an inline-styled `Decoration.mark`. */
function decorate(view: EditorView, hl: NotaHighlighter): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const docLen = view.state.doc.length;
  const { tokens } = hl.codeToTokens(view.state.doc.toString(), {
    lang: NOTA_LANG,
    theme: NOTA_THEME
  });
  // Tokens arrive in ascending absolute offset (line-major, then within line) — the order
  // RangeSetBuilder requires. Empty tokens are skipped so `from` stays strictly increasing.
  for (const line of tokens) {
    for (const tk of line) {
      const from = tk.offset;
      const to = from + tk.content.length;
      if (!tk.content || to > docLen) continue;
      const css: string[] = [];
      if (tk.color) css.push(`color:${tk.color}`);
      if (tk.fontStyle && tk.fontStyle & ITALIC) css.push("font-style:italic");
      if (tk.fontStyle && tk.fontStyle & BOLD) css.push("font-weight:700");
      if (tk.fontStyle && tk.fontStyle & UNDERLINE)
        css.push("text-decoration:underline");
      if (css.length)
        builder.add(
          from,
          to,
          Decoration.mark({ attributes: { style: css.join(";") } })
        );
    }
  }
  return builder.finish();
}

/** The CM6 extension: a ViewPlugin that repaints Shiki's tokens whenever the document changes. */
export function notaHighlighting(hl: NotaHighlighter): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = decorate(view, hl);
      }
      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = decorate(update.view, hl);
      }
    },
    { decorations: plugin => plugin.decorations }
  );
}

/** Convenience: a fresh highlighter wired into the CM extension. Rejects if Shiki fails to load. */
export async function createNotaHighlight(): Promise<Extension> {
  return notaHighlighting(await createNotaHighlighter());
}
