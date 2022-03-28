import { HighlightStyle, Tag, styleTags, tags as t } from "@codemirror/highlight";
import {
  LRLanguage,
  LanguageSupport,
  continuedIndent,
  delimitedIndent,
  flatIndent,
  foldInside,
  foldNodeProp,
  indentNodeProp,
} from "@codemirror/language";

import { autocomplete } from "./autocomplete";
//@ts-ignore
import { parser } from "./nota.grammar";

export let CodeTag = Tag.define();
export let notaLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
        "get set async static": t.modifier,
        "for while do if else switch try catch finally return throw break continue default case":
          t.controlKeyword,
        "in of await yield void typeof delete instanceof": t.operatorKeyword,
        "export import let var const function class extends": t.definitionKeyword,
        "with debugger from as new": t.keyword,
        TemplateString: t.special(t.string),
        Super: t.atom,
        BooleanLiteral: t.bool,
        this: t.self,
        null: t.null,
        Star: t.modifier,
        VariableName: t.variableName,
        "CallExpression/VariableName": t.function(t.variableName),
        VariableDefinition: t.definition(t.variableName),
        Label: t.labelName,
        PropertyName: t.propertyName,
        PrivatePropertyName: t.special(t.propertyName),
        "CallExpression/MemberExpression/PropertyName": t.function(t.propertyName),
        "FunctionDeclaration/VariableDefinition": t.function(t.definition(t.variableName)),
        "ClassDeclaration/VariableDefinition": t.definition(t.className),
        PropertyDefinition: t.definition(t.propertyName),
        PrivatePropertyDefinition: t.definition(t.special(t.propertyName)),
        UpdateOp: t.updateOperator,
        LineComment: t.lineComment,
        BlockComment: t.blockComment,
        Number: t.number,
        String: t.string,
        ArithOp: t.arithmeticOperator,
        LogicOp: t.logicOperator,
        BitOp: t.bitwiseOperator,
        CompareOp: t.compareOperator,
        RegExp: t.regexp,
        Equals: t.definitionOperator,
        "Arrow : Spread": t.punctuation,
        "( )": t.paren,
        "[ ]": t.squareBracket,
        "{ }": t.brace,
        ".": t.derefOperator,
        ", ;": t.separator,

        TypeName: t.typeName,
        TypeDefinition: t.definition(t.typeName),
        "type enum interface implements namespace module declare": t.definitionKeyword,
        "abstract global Privacy readonly override": t.modifier,
        "is keyof unique infer": t.operatorKeyword,

        JSXAttributeValue: t.attributeValue,
        JSXText: t.content,
        "JSXStartTag JSXStartCloseTag JSXSelfCloseEndTag JSXEndTag": t.angleBracket,
        "JSXIdentifier JSXNameSpacedName": t.tagName,
        "JSXAttribute/JSXIdentifier JSXAttribute/JSXNameSpacedName": t.attributeName,

        Text: t.content,
        CommandName: t.variableName,
        // "CommandNamedArg/Number": t.definitionKeyword,
        At: t.definitionKeyword,
        Pct: t.definitionKeyword,
        Hash: t.definitionKeyword,
        "NotaExpression/...": CodeTag,
        "NotaStatement/...": CodeTag,
      }),
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
  // { tag: CodeTag, background: "#f5f5f5" },
  { tag: t.content, class: "nota-editor-text" },
]);

export let nota = () => new LanguageSupport(notaLanguage, [notaCompletion, notaStyle]);
