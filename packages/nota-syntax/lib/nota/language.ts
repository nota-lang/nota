import { LRLanguage, LanguageSupport, indentNodeProp, continuedIndent } from "@codemirror/language";
import { styleTags, tags as t } from "@codemirror/highlight";

import { nota_parser } from "./translate";
import { autocomplete } from "./autocomplete";

export let nota_language = LRLanguage.define({
  parser: nota_parser.configure({
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
      indentNodeProp.add({
        ArgText: continuedIndent(),
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
