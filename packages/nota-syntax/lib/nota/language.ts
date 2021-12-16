import { parseMixed } from "@lezer/common";
import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags as t } from "@codemirror/highlight";

//@ts-ignore
import { parser, Js } from "./nota.grammar";
import { autocomplete } from "./autocomplete";
import { js_language } from "../javascript/language";

let wrap = parseMixed((node, _input) => {
  if (node.type.id == Js) {
    return { parser: js_language.parser };
  }
  return null;
});

export let nota_language = LRLanguage.define({
  parser: parser.configure({
    wrap,
    props: [
      styleTags({
        Text: t.string,
        Ident: t.definitionKeyword,
        Number: t.definitionKeyword,
        "CommandNamedArg/Ident": t.variableName,
        At: t.definitionKeyword,
        Pct: t.definitionKeyword,
        Hash: t.definitionKeyword,
        Comment: t.lineComment,
        "( )": t.paren,
        "{ }": t.brace,
        "[ ]": t.squareBracket,
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: "//" },
  },
});

let nota_completion = nota_language.data.of({
  autocomplete,
});

export let nota = () => new LanguageSupport(nota_language, [nota_completion]);
