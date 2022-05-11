import { tags as t } from "@lezer/highlight";
import {
  HighlightStyle,
  LRLanguage,
  LanguageSupport,
  continuedIndent,
  delimitedIndent,
  flatIndent,
  foldInside,
  foldNodeProp,
  indentNodeProp,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";

import { autocomplete } from "./autocomplete.js";
//@ts-ignore
import { parser } from "./nota.grammar.js";
import { CodeTag } from "./highlight.js";

export let notaLanguage = LRLanguage.define({
  parser: parser.configure({
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

let notaCompletion = notaLanguage.data.of({
  autocomplete,
});

let notaStyle = HighlightStyle.define([
  { tag: t.variableName, color: "#256" },
  { tag: CodeTag, class: "nota-editor-code" },
  { tag: t.content, class: "nota-editor-text" },
]);

export let nota = () =>
  new LanguageSupport(notaLanguage, [
    notaCompletion,
    syntaxHighlighting(notaStyle),
    syntaxHighlighting(defaultHighlightStyle),
  ]);
