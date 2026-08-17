/**
 * Debug CLI for the Nota editor highlighter. Runs a document through the *exact* stack the editor
 * uses — the wasm reader's `highlight` entry (`@nota-lang/codemirror`'s `highlightSpans`) plus the
 * embedded sub-language overlay on code/math interiors (`embeddedRegions` + CodeMirror parsers) —
 * then shows the result two ways:
 *
 *   1. an ANSI true-color render of the source (same kind→color table the CM6 theme uses), so the
 *      highlighting is visible in a terminal;
 *   2. with `--spans`, per-span tables (`[start..end) kind "excerpt"`) — the reader spans, then the
 *      embedded sub-language tokens — telling you *which classification each layer assigned*.
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
import { classHighlighter, highlightTree } from "@lezer/highlight";
import {
  embeddedRegions,
  highlightSpans,
  KIND_STYLES,
  languageFor
} from "@nota-lang/codemirror";
import { DEFAULT_SNIPPET } from "../src/default-snippet";
import { GOLDEN_NOTA } from "../src/golden";

/**
 * Kind → terminal style, **derived** from the editor's `KIND_STYLES` (the CM6 kind theme) — the
 * hand-mirrored copy here once drifted two kinds behind the reader. Text decorations that don't
 * translate to ANSI (strike-through) render default.
 */
const KIND_COLORS: Record<
  string,
  { color?: string; bold?: boolean; italic?: boolean }
> = Object.fromEntries(
  Object.entries(KIND_STYLES).map(([kind, style]) => [
    kind,
    {
      color: style.color,
      bold: style.fontWeight === "700",
      italic: style.fontStyle === "italic"
    }
  ])
);

/**
 * Embedded sub-language tag → terminal style, mirroring the Catppuccin `HighlightStyle` the editor
 * applies to code/math interiors (highlight-style.ts). Keyed by `@lezer/highlight` `classHighlighter`
 * names sans the `tok-` prefix; tags the editor leaves default (plain `variableName`, `definition`)
 * are absent → rendered in the default foreground, exactly as in the editor.
 */
const TOK_COLORS: Record<
  string,
  { color?: string; bold?: boolean; italic?: boolean }
> = {
  keyword: { color: "#8839ef" },
  string: { color: "#40a02b" },
  regexp: { color: "#40a02b" },
  number: { color: "#fe640b" },
  bool: { color: "#fe640b" },
  null: { color: "#fe640b" },
  atom: { color: "#fe640b" },
  escape: { color: "#fe640b" },
  propertyName: { color: "#1e66f5" },
  typeName: { color: "#1e66f5" },
  className: { color: "#1e66f5" },
  namespace: { color: "#1e66f5" },
  tagName: { color: "#1e66f5" },
  attributeName: { color: "#df8e1d" },
  operator: { color: "#04a5e5" },
  punctuation: { color: "#7c7f93" },
  bracket: { color: "#7c7f93" },
  comment: { color: "#8c8fa1", italic: true },
  meta: { color: "#8c8fa1" },
  invalid: { color: "#d20f39" }
};

/** Resolve a `classHighlighter` class string (`"tok-variableName tok-definition"`) to a style. */
function tokStyle(
  classes: string
): { color?: string; bold?: boolean; italic?: boolean } | undefined {
  for (const cls of classes.split(" ")) {
    const style = TOK_COLORS[cls.replace(/^tok-/, "")];
    if (style) return style;
  }
  return undefined;
}

const args = process.argv.slice(2);
const wantSpans = args.includes("--spans");
const positional = args.filter(a => !a.startsWith("--"));

let source: string;
let label: string;
if (args.includes("--golden")) {
  source = GOLDEN_NOTA;
  label = "GOLDEN_NOTA";
} else if (args.includes("--mega")) {
  const mega = fileURLToPath(
    new URL("../../../integration/mega.nota", import.meta.url)
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

const spans = highlightSpans(source); // throws with the reader's diagnostics on a parse error

// 1. ANSI render: paint reader spans in list order (outer first, inner overrides), then overlay the
// embedded sub-language tokens on code/math interiors — exactly as the editor does. Styles merge
// per character.
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

// Embedded overlay: tokenize each code/math interior with its language (classHighlighter tags), reset
// the interior so the flat green doesn't bleed between tokens, then paint the tokens.
interface EmbeddedTok {
  from: number;
  to: number;
  tag: string;
}
const regions = embeddedRegions(source);
const embedded: EmbeddedTok[] = [];
for (const region of regions) {
  const language = languageFor(region.lang);
  if (!language) continue; // unknown language / inline code: keep the reader's flat paint
  highlightTree(
    language.parser.parse(source.slice(region.from, region.to)),
    classHighlighter,
    (from, to, tag) => {
      embedded.push({ from: region.from + from, to: region.from + to, tag });
    }
  );
  for (let i = region.from; i < region.to && i < source.length; i++)
    styles[i] = {};
}
for (const tok of embedded) {
  const style = tokStyle(tok.tag);
  if (!style) continue;
  for (let i = tok.from; i < tok.to && i < source.length; i++) {
    styles[i] = { ...style };
  }
}

console.log(
  `── ${label} · ${spans.length} reader spans + ${embedded.length} embedded tokens ──\n`
);
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
  console.log("\n── reader spans ──");
  for (const span of spans) {
    const range = `[${span.from}..${span.to})`;
    const excerpt = JSON.stringify(source.slice(span.from, span.to));
    console.log(
      `${range.padEnd(12)} ${span.kind.padEnd(16)} ${excerpt.length > 60 ? `${excerpt.slice(0, 57)}…` : excerpt}`
    );
  }
  if (embedded.length > 0) {
    console.log("\n── embedded tokens ──");
    for (const tok of embedded) {
      const range = `[${tok.from}..${tok.to})`;
      const excerpt = JSON.stringify(source.slice(tok.from, tok.to));
      console.log(
        `${range.padEnd(12)} ${tok.tag.replace(/tok-/g, "").padEnd(24)} ${excerpt.length > 40 ? `${excerpt.slice(0, 37)}…` : excerpt}`
      );
    }
  }
}
