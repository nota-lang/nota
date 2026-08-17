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
import { highlightTree, tagHighlighter } from "@lezer/highlight";
import {
  catppuccinLatte,
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
 * Embedded sub-language tag → terminal style, **derived** from the editor's own Catppuccin
 * `HighlightStyle` (`catppuccinLatte`, highlight-style.ts) — a hand-typed hex copy here once
 * drifted, the same risk {@link KIND_COLORS} above solves by deriving from `KIND_STYLES`. Each
 * spec's own most-specific tag names its terminal label, and {@link embeddedHighlighter} resolves
 * a real token's tags against those labels with the editor's own specificity precedence (e.g.
 * `attributeName` wins over its `propertyName` ancestor) — so a tag the editor leaves uncolored
 * (plain `variableName`) stays unstyled here too, and a recolor in highlight-style.ts can't leave
 * this table behind.
 */
const EMBEDDED_STYLES = catppuccinLatte.specs.map(spec => ({
  tag: spec.tag,
  label: String(Array.isArray(spec.tag) ? spec.tag[0] : spec.tag),
  color: spec.color as string | undefined,
  bold: spec.fontWeight === "700",
  italic: spec.fontStyle === "italic"
}));

/** Resolves an embedded token's tags to its {@link EMBEDDED_STYLES} label, most-specific first —
 * the same `tagHighlighter` resolution `@lezer/highlight`'s own `classHighlighter` uses, just
 * keyed on `catppuccinLatte`'s labels instead of its fixed `tok-*` vocabulary. */
const embeddedHighlighter = tagHighlighter(
  EMBEDDED_STYLES.map(({ tag, label }) => ({ tag, class: label }))
);

const TOK_COLORS: Record<
  string,
  { color?: string; bold?: boolean; italic?: boolean }
> = Object.fromEntries(
  EMBEDDED_STYLES.map(({ label, color, bold, italic }) => [
    label,
    { color, bold, italic }
  ])
);

/** Resolve an {@link embeddedHighlighter} class string to a style (its first class is always the
 * most-specific tag's match, and — by construction — always a known {@link TOK_COLORS} label). */
function tokStyle(
  classes: string
): { color?: string; bold?: boolean; italic?: boolean } | undefined {
  return TOK_COLORS[classes.split(" ")[0]];
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

// Embedded overlay: tokenize each code/math interior with its language (embeddedHighlighter tags),
// reset the interior so the flat green doesn't bleed between tokens, then paint the tokens.
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
    embeddedHighlighter,
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
        `${range.padEnd(12)} ${tok.tag.padEnd(24)} ${excerpt.length > 40 ? `${excerpt.slice(0, 37)}…` : excerpt}`
      );
    }
  }
}
