/**
 * CM6 syntax highlighting for the **Generated-JS** pane: the `@codemirror/lang-javascript` Lezer
 * parser paired with a hand-rolled {@link HighlightStyle}. We don't reuse CM's `defaultHighlightStyle`
 * (it's tuned for light backgrounds); instead we map the Lezer tags onto the Catppuccin-Mocha palette
 * already in `playground.css`, so the colored tokens sit cohesively on the same dark theme as the
 * editor (which itself runs theme-less, inheriting the page's light-on-dark text).
 */

import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";

// Catppuccin Mocha — the same hues used by the `--*` vars and `.cm-nota-*` classes in playground.css.
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
  // Keywords: `import`/`export`, `let`/`const`, `return`/`for`, `typeof`, `this`, modifiers.
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
  { tag: [t.string, t.special(t.string), t.regexp], color: green },
  { tag: [t.number, t.bool, t.null, t.atom], color: peach },
  { tag: t.escape, color: peach },
  // Call sites read as functions: `h(...)`, `decode(...)`, `.map(...)`.
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: blue
  },
  { tag: t.propertyName, color: blue },
  { tag: [t.typeName, t.className, t.namespace], color: yellow },
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
  { tag: t.invalid, color: red }
]);

/** The JS language + Catppuccin highlight, as one CM6 extension for the read-only {@link CodeView}. */
export function jsLanguage(): Extension {
  return [javascript(), syntaxHighlighting(catppuccinMocha)];
}
