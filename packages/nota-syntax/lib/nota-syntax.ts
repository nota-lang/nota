export type { Translation, TranslatedFunction } from "./translate_nota";

import { parseMixed, Tree } from "@lezer/common";
import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags as t } from "@codemirror/highlight";
import { Result, ok, err } from "@wcrichto/nota-common";

//@ts-ignore
import { parser as js_parser } from "./javascript/javascript.grammar";
//@ts-ignore
import { parser as nota_parser } from "./nota.grammar";
//@ts-ignore
import * as nota_terms from "./nota.terms";
//@ts-ignore
import * as js_terms from "./javascript/javascript.terms";
import { Parse } from "@lezer/lr/dist/parse";

let nota_wrap = parseMixed((node, _input) => {
  if (node.type.id == nota_terms.Js) {
    return { parser: js_language.parser };
  }
  return null;
});

export let nota_language = LRLanguage.define({
  parser: nota_parser.configure({
    wrap: nota_wrap,
    props: [
      styleTags({
        Text: t.string,
        Ident: t.definitionKeyword,
        Number: t.definitionKeyword,
        "CommandNamedArg/Ident": t.variableName,
        At: t.definitionKeyword,
        Pct: t.definitionKeyword,
        Hash: t.definitionKeyword,
        "( )": t.paren,
        "{ }": t.brace,
        "[ ]": t.squareBracket,
      }),
    ],
  }),
});

export let nota = () => new LanguageSupport(nota_language);

export let try_parse = (contents: string): Result<Tree> => {
  let parse = nota_language.parser.startParse(contents) as Parse;
  while (true) {
    let tree = parse.advance();
    if (tree != null) {
      return ok(tree);
    } else if (parse.recovering) {
      let pos = parse.parsedPos - 1;
      let prefix = contents.slice(Math.max(0, pos - 10), pos);
      let suffix = contents.slice(pos + 1, pos + 10);
      let msg = `Invalid parse at: ${prefix}>>>${contents[pos]}<<<${suffix}`;
      if (parse.tokens.mainToken) {
        let token = nota_language.parser.getName(parse.tokens.mainToken.value);
        msg += ` (unexpected token ${token})`;
      }

      return err(Error(msg));
    }
  }
};

let js_wrap = parseMixed((node, _input) => {
  if (node.type.id == js_terms.NotaMacro) {
    return { parser: nota_language.parser };
  }
  return null;
});

// copied from https://github.com/codemirror/lang-javascript/blob/main/src/javascript.ts
export let js_language = LRLanguage.define({
  parser: js_parser.configure({
    wrap: js_wrap,
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
