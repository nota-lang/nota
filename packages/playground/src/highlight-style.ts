/**
 * The shared CM6 highlight for every output pane (Generated JS, SSG-output HTML + manifest). Lezer's
 * `tags` are language-agnostic — `@lezer/javascript`, `@lezer/html`, and `@lezer/json` all assign the
 * same standard set — so one {@link HighlightStyle} colors all three. We map those tags onto the
 * Catppuccin-Latte palette (the light variant matching the `--*` vars in `playground.css` and the
 * editor's kind theme in nota-mode.ts), so the panes' tokens sit cohesively on the light theme.
 */

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";

// Catppuccin Latte (light) — readable on the white/light panes; mirrors the editor's kind theme.
const mauve = "#8839ef";
const green = "#40a02b";
const peach = "#fe640b";
const blue = "#1e66f5";
const yellow = "#df8e1d";
const sky = "#04a5e5";
const overlay = "#7c7f93";
const muted = "#8c8fa1";
const red = "#d20f39";

/**
 * The Catppuccin-Latte {@link HighlightStyle}. Exported so the editor's embedded sub-language
 * highlighter (embedded-langs.ts) can color its tokens through the *same* tag→color mapping via
 * `highlightTree`, not just the output panes' `syntaxHighlighting` path.
 */
export const catppuccinLatte = HighlightStyle.define([
  // Keywords (JS): `import`/`export`, `let`/`const`, `return`/`for`, `typeof`, `this`, modifiers.
  {
    tag: [
      t.keyword,
      t.controlKeyword,
      t.operatorKeyword,
      t.definitionKeyword,
      t.moduleKeyword,
      t.modifier,
      t.self
    ],
    color: mauve
  },
  // Strings & string-ish values, incl. HTML attribute values.
  {
    tag: [t.string, t.special(t.string), t.regexp, t.attributeValue],
    color: green
  },
  { tag: [t.number, t.bool, t.null, t.atom], color: peach },
  { tag: [t.escape, t.character], color: peach },
  // Call sites read as functions: `h(...)`, `decode(...)`, `.map(...)`; HTML/JSON keys read as names.
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: blue
  },
  { tag: t.propertyName, color: blue },
  // Types, classes, and HTML element names — structural identifiers.
  { tag: [t.typeName, t.className, t.namespace, t.tagName], color: blue },
  { tag: t.attributeName, color: yellow },
  {
    tag: [
      t.operator,
      t.derefOperator,
      t.arithmeticOperator,
      t.logicOperator,
      t.compareOperator,
      t.definitionOperator
    ],
    color: sky
  },
  {
    tag: [
      t.punctuation,
      t.separator,
      t.bracket,
      t.brace,
      t.paren,
      t.squareBracket,
      t.angleBracket
    ],
    color: overlay
  },
  {
    tag: [t.comment, t.lineComment, t.blockComment],
    color: muted,
    fontStyle: "italic"
  },
  { tag: [t.meta, t.processingInstruction, t.documentMeta], color: muted },
  { tag: t.invalid, color: red }
]);

/** The Catppuccin highlight as a ready-to-compose CM6 extension. */
export const catppuccinHighlight: Extension =
  syntaxHighlighting(catppuccinLatte);
