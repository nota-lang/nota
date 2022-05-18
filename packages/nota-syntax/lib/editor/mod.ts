import {
  HighlightStyle,
  LRLanguage,
  Language,
  LanguageSupport,
  continuedIndent,
  defaultHighlightStyle,
  defineLanguageFacet,
  delimitedIndent,
  flatIndent,
  foldInside,
  foldNodeProp,
  indentNodeProp,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

import { CodeTag, jsParser, mdParser } from "../parse/mod.js";
import { autocomplete } from "./autocomplete.js";

let notaJsLanguage = LRLanguage.define({
  parser: jsParser.configure({
    props: [
      indentNodeProp.add({
        IfStatement: continuedIndent({ except: /^\s*({|else\b)/ }),
        TryStatement: continuedIndent({ except: /^\s*({|catch\b|finally\b)/ }),
        LabeledStatement: flatIndent,
        SwitchBody: context => {
          let after = context.textAfter,
            closed = /^\s*\}/.test(after),
            isCase = /^\s*(case|default)\b/.test(after);
          return context.baseIndent + (closed ? 0 : isCase ? 1 : 2) * context.unit;
        },
        Block: delimitedIndent({ closing: "}" }),
        ArrowFunction: cx => cx.baseIndent + cx.unit,
        "TemplateString BlockComment": () => -1,
        "Statement Property": continuedIndent({ except: /^{/ }),
        JSXElement(context) {
          let closed = /^\s*<\//.test(context.textAfter);
          return context.lineIndent(context.node.from) + (closed ? 0 : context.unit);
        },
        JSXEscape(context) {
          let closed = /\s*\}/.test(context.textAfter);
          return context.lineIndent(context.node.from) + (closed ? 0 : context.unit);
        },
        "JSXOpenTag JSXSelfClosingTag"(context) {
          return context.column(context.node.from) + context.unit;
        },
        ArgText: continuedIndent(),
        PctCommand: continuedIndent(),
      }),
      foldNodeProp.add({
        "Block ClassBody SwitchBody EnumBody ObjectExpression ArrayExpression": foldInside,
        BlockComment(tree) {
          return { from: tree.from + 2, to: tree.to - 2 };
        },
      }),
      indentNodeProp.add({
        ArgText: continuedIndent(),
      }),
    ],
  }),
  languageData: {
    closeBrackets: { brackets: ["(", "[", "{", "'", '"', "`"] },
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
    indentOnInput: /^\s*(?:case |default:|\{|\}|<\/)$/,
    wordChars: "$",
  },
});

let notaCompletion = notaJsLanguage.data.of({
  autocomplete,
});

let notaJsStyle = HighlightStyle.define([
  { tag: CodeTag, class: "nota-editor-code" },
  { tag: t.content, class: "nota-editor-text" },
]);

let notaJs = new LanguageSupport(notaJsLanguage, [
  notaCompletion,
  syntaxHighlighting(notaJsStyle),
  syntaxHighlighting(defaultHighlightStyle),
]);

let notaMdStyle = HighlightStyle.define([
  /*{ tag: t.heading1, color: "red" }*/
]);

export let nota = (config: {} = {}): LanguageSupport => {
  let notaLang = new Language(defineLanguageFacet({}), mdParser);
  return new LanguageSupport(notaLang, [notaJs, syntaxHighlighting(notaMdStyle)]);
};
