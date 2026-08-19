/** Tokenize embedded code and math with CodeMirror language parsers. */

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

export interface EmbeddedToken {
  from: number;
  to: number;
  classes: string;
}

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

const ALIASES: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  cts: "typescript",
  mts: "typescript",
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

/** Resolve a case-insensitive fence tag to a CodeMirror language. */
export function languageFor(lang: string | null): Language | null {
  if (!lang) return null;
  const key = lang.trim().toLowerCase();
  return LANGUAGES[ALIASES[key] ?? key] ?? null;
}

/** Tokenize an embedded source, returning an empty list for unsupported languages. */
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
