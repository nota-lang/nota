/**
 * Debug CLI for the Nota editor highlighter. Tokenizes a document through the *exact* stack the
 * editor uses (`createNotaHighlighter` from src/nota-mode.ts — same grammar, theme, and theme
 * augmentation), then shows the result two ways:
 *
 *   1. an ANSI true-color render of the source, so the highlighting is visible in a terminal;
 *   2. with `--scopes`, a per-token table of `[start..end) "content" color  scope > scope > …`
 *      (Shiki's `includeExplanation`), which is the view that tells you *which grammar rule fired*.
 *
 * Usage (from packages/playground):
 *   node_modules/.bin/tsx scripts/dump-tokens.ts [file.nota] [--scopes]
 *   node_modules/.bin/tsx scripts/dump-tokens.ts --default | --golden | --mega   # built-in docs
 *
 * `--mega` is `integration/mega.nota` (the repo's feature mega-test) — the canonical stress doc;
 * it currently breaks the TextMate grammar catastrophically (see the markup-valued prop on its
 * `@figure[cap:@em{…}]` line: everything after it tokenizes inside a runaway `source.ts` scope).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SNIPPET } from "../src/default-snippet";
import { GOLDEN_NOTA } from "../src/golden";
import { createNotaHighlighter, NOTA_LANG, NOTA_THEME } from "../src/nota-mode";

/** Shiki token with the `explanation` field present when `includeExplanation` is set. */
interface ExplainedToken {
  content: string;
  offset: number;
  color?: string;
  fontStyle?: number;
  explanation?: { content: string; scopes: { scopeName: string }[] }[];
}

const args = process.argv.slice(2);
const wantScopes = args.includes("--scopes");
const positional = args.filter(a => !a.startsWith("--"));

let source: string;
let label: string;
if (args.includes("--golden")) {
  source = GOLDEN_NOTA;
  label = "GOLDEN_NOTA";
} else if (args.includes("--mega")) {
  const mega = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../integration/mega.nota"
  );
  source = readFileSync(mega, "utf8");
  label = "integration/mega.nota";
} else if (positional.length > 0) {
  source = readFileSync(positional[0], "utf8");
  label = positional[0];
} else {
  source = DEFAULT_SNIPPET;
  label = "DEFAULT_SNIPPET";
}

function ansiColor(hex: string | undefined): string {
  if (!hex) return "";
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "";
  const n = Number.parseInt(m[1], 16);
  return `\x1b[38;2;${(n >> 16) & 0xff};${(n >> 8) & 0xff};${n & 0xff}m`;
}

const hl = await createNotaHighlighter();
const { tokens } = hl.codeToTokens(source, {
  lang: NOTA_LANG,
  theme: NOTA_THEME,
  // Passed through to Shiki (not in the bridge's narrow NotaHighlighter type).
  ...({ includeExplanation: "scopeName" } as object)
});

console.log(`── ${label} · lang=${NOTA_LANG} theme=${NOTA_THEME} ──\n`);

// 1. ANSI render.
for (const line of tokens) {
  let out = "";
  for (const tk of line as ExplainedToken[]) {
    const bold = tk.fontStyle && tk.fontStyle & 2 ? "\x1b[1m" : "";
    const italic = tk.fontStyle && tk.fontStyle & 1 ? "\x1b[3m" : "";
    out += `${ansiColor(tk.color)}${bold}${italic}${tk.content}\x1b[0m`;
  }
  console.log(out);
}

// 2. Token/scope table.
if (wantScopes) {
  console.log("\n── tokens ──");
  for (const line of tokens) {
    for (const tk of line as ExplainedToken[]) {
      if (!tk.content.trim()) continue;
      const range = `[${tk.offset}..${tk.offset + tk.content.length})`;
      const scopes = (tk.explanation ?? [])
        .map(e =>
          e.scopes
            .map(s => s.scopeName)
            .filter(s => s !== "source.nota")
            .join(" > ")
        )
        .join(" | ");
      console.log(
        `${range.padEnd(12)} ${JSON.stringify(tk.content).padEnd(28)} ${(tk.color ?? "-").padEnd(8)} ${scopes}`
      );
    }
  }
}
