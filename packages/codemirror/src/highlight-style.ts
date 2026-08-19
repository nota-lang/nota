/** Shared Catppuccin Latte highlighting for embedded and output languages. */

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";

import { PALETTE } from "./palette";

const { mauve, green, peach, blue, yellow, sky, overlay, muted, red } = PALETTE;

export const catppuccinLatte = HighlightStyle.define([
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
  {
    tag: [t.string, t.special(t.string), t.regexp, t.attributeValue],
    color: green
  },
  { tag: [t.number, t.bool, t.null, t.atom], color: peach },
  { tag: [t.escape, t.character], color: peach },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: blue
  },
  { tag: t.propertyName, color: blue },
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

export const catppuccinHighlight: Extension =
  syntaxHighlighting(catppuccinLatte);
