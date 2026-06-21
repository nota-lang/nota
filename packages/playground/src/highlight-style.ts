/**
 * The shared CM6 highlight for every output pane (Generated JS, Post-SSG HTML + manifest). Lezer's
 * `tags` are language-agnostic — `@lezer/javascript`, `@lezer/html`, and `@lezer/json` all assign the
 * same standard set — so one {@link HighlightStyle} colors all three. We map those tags onto the
 * Catppuccin-Mocha palette already used by the `--*` vars and `.cm-nota-*` classes in `playground.css`,
 * rather than CM's light-tuned `defaultHighlightStyle`, so tokens sit cohesively on the dark theme.
 */

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";

// Catppuccin Mocha.
const mauve = "#cba6f7";
const green = "#a6e3a1";
const peach = "#fab387";
const blue = "#89b4fa";
const yellow = "#f9e2af";
const sky = "#89dceb";
const overlay = "#9399b2";
const muted = "#6c7086";
const red = "#f38ba8";

const catppuccinMocha = HighlightStyle.define([
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
  syntaxHighlighting(catppuccinMocha);
