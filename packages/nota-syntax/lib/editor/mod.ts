import {
  HighlightStyle,
  LRLanguage,
  Language,
  LanguageDescription,
  LanguageSupport,
  ParseContext,
  TreeIndentContext,
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
import { KeyBinding, keymap } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { MarkdownParser, parseCode } from "@lezer/markdown";

import { CodeTag, MathTag, jsParser, mdParser, mdTerms } from "../parse/mod.js";
import { autocomplete } from "./autocomplete.js";
import { deleteMarkupBackward, insertNewlineContinueMarkup } from "./commands";

let notaJsLanguage = LRLanguage.define({
  parser: jsParser.configure({
    props: [
      // copied from @codemirror/javascript
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
    ],
  }),
  languageData: {
    closeBrackets: { brackets: ["(", "[", "{", "'", '"', "`"] },
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
    indentOnInput: /^\s*(?:case |default:|\{|\}|<\/)$/,
    wordChars: "$",
  },
});

let notaJsStyle = HighlightStyle.define([
  { tag: CodeTag, class: "nota-editor-code" },
  { tag: MathTag, color: "rgb(31, 95, 31)" },
  { tag: t.content, class: "nota-editor-text" },
  { tag: t.brace, color: "#333" },
]);

let notaJs = new LanguageSupport(notaJsLanguage, [
  syntaxHighlighting(notaJsStyle),
  syntaxHighlighting(defaultHighlightStyle),
]);

let notaMdStyle = HighlightStyle.define([]);

export function mkLang(parser: MarkdownParser) {
  return new Language(
    defineLanguageFacet({
      commentTokens: { line: "//" },
      autocomplete,
    }),
    parser.configure({
      props: [
        indentNodeProp.add({
          // NotaBlockComponent: continuedIndent(),
          Document: (context: TreeIndentContext) => {
            let child = context.node.resolveInner(context.pos, -1);
            let baseIndent = context.lineIndent(child.from);
            if (
              child.type.id == mdTerms.NotaBlockComponent ||
              child.type.id == mdTerms.NotaBlockAttribute
            ) {
              return baseIndent + context.unit;
            }

            return baseIndent;
          },
        }),
      ],
    })
  );
}

// Copied from
// https://github.com/codemirror/lang-markdown/blob/91c316431ab2df5649127af32e95fc74dbca0d97/src/markdown.ts#L35
export type CodeLanguageDescriptions =
  | readonly LanguageDescription[]
  | ((info: string) => Language | LanguageDescription | null)
  | undefined;
export function getCodeParser(languages: CodeLanguageDescriptions, defaultLanguage?: Language) {
  return (info: string) => {
    if (info && languages) {
      let found = null;
      if (typeof languages == "function") found = languages(info);
      else found = LanguageDescription.matchLanguageName(languages, info, true);
      if (found instanceof LanguageDescription)
        return found.support
          ? found.support.language.parser
          : ParseContext.getSkippingParser(found.load());
      else if (found) return found.parser;
    }
    return defaultLanguage ? defaultLanguage.parser : null;
  };
}

export let nota = (
  config: {
    codeLanguages?: CodeLanguageDescriptions;
  } = {}
): LanguageSupport => {
  let mdExtensions = [
    parseCode({
      codeParser: getCodeParser(config.codeLanguages),
    }),
  ];
  let lang = mkLang(mdParser.configure(mdExtensions));
  let markdownKeymap: readonly KeyBinding[] = [
    { key: "Enter", run: insertNewlineContinueMarkup(lang) },
    { key: "Backspace", run: deleteMarkupBackward(lang) },
  ];

  return new LanguageSupport(lang, [
    syntaxHighlighting(notaMdStyle),
    syntaxHighlighting(defaultHighlightStyle),
    notaJs,
    keymap.of(markdownKeymap),
  ]);
};
