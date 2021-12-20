import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags as t } from "@codemirror/highlight";

import { js_parser } from "./translate";

// copied from https://github.com/codemirror/lang-javascript/blob/main/src/javascript.ts
export let js_language = LRLanguage.define({
  parser: js_parser.configure({
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
      }),
    ],
  }),
});

export let js = () => new LanguageSupport(js_language);
