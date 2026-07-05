/**
 * Embedded sub-language highlighting for the Nota editor. The reader classifies a code/math span's
 * *interior* as one flat `code`/`math` kind (see nota-mode.ts); this module tokenizes that interior
 * with the fence's language (math → always TeX) using CodeMirror's own Lezer/stream parsers, coloring
 * the tokens through the shared Catppuccin-Latte `HighlightStyle` (highlight-style.ts).
 *
 * The reader owns Nota; CM owns the embedded foreign languages — the same split the read-only output
 * panes already use (js-mode.ts / html-mode.ts / json-mode.ts). The supported set mirrors the
 * prelude's shiki languages (packages/prelude/src/code.ts) so the editor highlights exactly what the
 * document can render, plus (La)TeX for math. An unknown language returns no tokens, and the caller
 * keeps the reader's flat under-layer.
 */

import { htmlLanguage } from "@codemirror/lang-html";
import {
  javascriptLanguage,
  jsxLanguage,
  tsxLanguage,
  typescriptLanguage
} from "@codemirror/lang-javascript";
import { jsonLanguage } from "@codemirror/lang-json";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { type Language, StreamLanguage } from "@codemirror/language";
import { css } from "@codemirror/legacy-modes/mode/css";
import { python } from "@codemirror/legacy-modes/mode/python";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { highlightTree } from "@lezer/highlight";
import { catppuccinLatte } from "./highlight-style";

/** One classified token inside an embedded region; offsets are relative to the region text. */
export interface EmbeddedToken {
  from: number;
  to: number;
  /** The Catppuccin-Latte `HighlightStyle` class(es) for this token. */
  classes: string;
}

// Canonical language → its CodeMirror parser. `StreamLanguage.define` wraps a legacy stream mode as a
// `Language`; the `@codemirror/lang-*` packages already ship `Language` objects. Math maps to `tex`
// (the `stex` (La)TeX mode). Mirrors prelude/src/code.ts's `BASE_LANGS`.
const LANGUAGES: Record<string, Language> = {
  javascript: javascriptLanguage,
  typescript: typescriptLanguage,
  jsx: jsxLanguage,
  tsx: tsxLanguage,
  json: jsonLanguage,
  html: htmlLanguage,
  markdown: markdownLanguage,
  python: StreamLanguage.define(python),
  rust: StreamLanguage.define(rust),
  shell: StreamLanguage.define(shell),
  css: StreamLanguage.define(css),
  tex: StreamLanguage.define(stex)
};

// Fence info-string aliases → a canonical {@link LANGUAGES} key. (The reader hands us the fence's
// first whitespace-delimited token verbatim, e.g. ```` ```py ````.)
const ALIASES: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  py: "python",
  rs: "rust",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  shellscript: "shell",
  console: "shell",
  htm: "html",
  md: "markdown",
  latex: "tex"
};

/** The CodeMirror `Language` for a fence tag (case-insensitive, alias-aware), or `null` if unknown. */
export function languageFor(lang: string | null): Language | null {
  if (!lang) return null;
  const key = lang.trim().toLowerCase();
  return LANGUAGES[ALIASES[key] ?? key] ?? null;
}

/**
 * Tokenize `text` as `lang` (a fence tag, or `"tex"` for math) into Catppuccin-Latte-classed spans.
 * Returns `[]` for an unknown/absent language or a parse failure — the caller then keeps the reader's
 * flat `code`/`math` under-layer. Parsing is synchronous (fits the ViewPlugin) and sees only `text`,
 * so a code block is a self-contained document to its parser.
 */
export function embeddedTokens(
  text: string,
  lang: string | null
): EmbeddedToken[] {
  const language = languageFor(lang);
  if (!language) return [];
  const tokens: EmbeddedToken[] = [];
  try {
    const tree = language.parser.parse(text);
    highlightTree(tree, catppuccinLatte, (from, to, classes) => {
      tokens.push({ from, to, classes });
    });
  } catch {
    return [];
  }
  return tokens;
}
