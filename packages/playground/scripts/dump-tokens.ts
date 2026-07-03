/**
 * Debug CLI for the Nota editor highlighter. Runs a document through the *exact* stack the editor
 * uses (the wasm reader's `highlight` entry via src/nota-mode.ts `highlightSpans`), then shows the
 * result two ways:
 *
 *   1. an ANSI true-color render of the source (same kind→color table the CM6 theme uses), so the
 *      highlighting is visible in a terminal;
 *   2. with `--spans`, a per-span table of `[start..end) kind "excerpt"` — the view that tells you
 *      *which classification the reader assigned*.
 *
 * Usage (from packages/playground):
 *   node_modules/.bin/tsx scripts/dump-tokens.ts [file.nota] [--spans]
 *   node_modules/.bin/tsx scripts/dump-tokens.ts --default | --golden | --mega   # built-in docs
 *
 * `--mega` is `integration/mega.nota` (the repo's feature mega-test) — the canonical stress doc,
 * and the regression fixture that broke the old TextMate-grammar highlighter.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import init from "nota_wasm";
import { DEFAULT_SNIPPET } from "../src/default-snippet";
import { GOLDEN_NOTA } from "../src/golden";
import { highlightSpans } from "../src/nota-mode";

/** Kind → terminal style, mirroring nota-mode's Catppuccin-Latte CM6 theme. */
const KIND_COLORS: Record<string, { color?: string; bold?: boolean; italic?: boolean }> = {
  heading: { color: "#d20f39", bold: true },
  "emphasis-strong": { bold: true },
  "emphasis-em": { italic: true },
  math: { color: "#40a02b" },
  code: { color: "#40a02b" },
  verbatim: { color: "#40a02b" },
  sigil: { color: "#179299" },
  "tag-host": { color: "#1e66f5" },
  "tag-component": { color: "#df8e1d" },
  "prop-name": { color: "#7287fd" },
  interpolation: { color: "#e64553" },
  "control-keyword": { color: "#8839ef" },
  "heading-marker": { color: "#d20f39", bold: true },
  "list-marker": { color: "#179299" },
  "math-delim": { color: "#7c7f93" },
  "code-delim": { color: "#7c7f93" },
  "code-lang": { color: "#1e66f5" },
  escape: { color: "#ea76cb" },
  "js-keyword": { color: "#8839ef" },
  "js-string": { color: "#40a02b" },
  "js-number": { color: "#fe640b" },
  "js-comment": { color: "#8c8fa1", italic: true },
  "js-operator": { color: "#179299" }
};

const args = process.argv.slice(2);
const wantSpans = args.includes("--spans");
const positional = args.filter(a => !a.startsWith("--"));

let source: string;
let label: string;
if (args.includes("--golden")) {
  source = GOLDEN_NOTA;
  label = "GOLDEN_NOTA";
} else if (args.includes("--mega")) {
  const mega = fileURLToPath(new URL("../../../integration/mega.nota", import.meta.url));
  source = readFileSync(mega, "utf8");
  label = "integration/mega.nota";
} else if (positional.length > 0) {
  source = readFileSync(positional[0], "utf8");
  label = positional[0];
} else {
  source = DEFAULT_SNIPPET;
  label = "DEFAULT_SNIPPET";
}

// Plain Node (no Vite): hand the wasm bytes straight to init — compiler.ts's `?url` route only
// resolves through Vite, so the CLI initializes the wasm module itself.
const wasmPath = fileURLToPath(import.meta.resolve("nota_wasm")).replace(
  /nota_wasm\.js$/,
  "nota_wasm_bg.wasm"
);
await init(readFileSync(wasmPath));

const spans = highlightSpans(source); // throws with the reader's diagnostics on a parse error

console.log(`── ${label} · ${spans.length} spans (reader-driven) ──\n`);

// 1. ANSI render: paint spans in list order — outer spans first, inner (later) spans override,
// matching the CSS layering in the editor. Styles merge per character.
interface CharStyle {
  color?: string;
  bold?: boolean;
  italic?: boolean;
}
const styles: CharStyle[] = Array.from({ length: source.length }, () => ({}));
for (const span of spans) {
  const kind = KIND_COLORS[span.kind];
  if (!kind) continue;
  for (let i = span.from; i < span.to && i < source.length; i++) {
    if (kind.color) styles[i].color = kind.color;
    if (kind.bold) styles[i].bold = true;
    if (kind.italic) styles[i].italic = true;
  }
}
function ansi(style: CharStyle): string {
  let out = "\x1b[0m";
  if (style.color) {
    const n = Number.parseInt(style.color.slice(1), 16);
    out += `\x1b[38;2;${(n >> 16) & 0xff};${(n >> 8) & 0xff};${n & 0xff}m`;
  }
  if (style.bold) out += "\x1b[1m";
  if (style.italic) out += "\x1b[3m";
  return out;
}
let rendered = "";
let last = "";
for (let i = 0; i < source.length; i++) {
  const code = ansi(styles[i]);
  if (code !== last) {
    rendered += code;
    last = code;
  }
  rendered += source[i];
}
console.log(`${rendered}\x1b[0m`);

// 2. Span table.
if (wantSpans) {
  console.log("\n── spans ──");
  for (const span of spans) {
    const range = `[${span.from}..${span.to})`;
    const excerpt = JSON.stringify(source.slice(span.from, span.to));
    console.log(
      `${range.padEnd(12)} ${span.kind.padEnd(16)} ${excerpt.length > 60 ? `${excerpt.slice(0, 57)}…` : excerpt}`
    );
  }
}
