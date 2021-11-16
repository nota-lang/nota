import React, { useEffect, useRef, useContext } from "react";

import { parser } from "@wcrichto/nota-syntax";
import { StateContext } from "./state";

import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags as t } from "@codemirror/highlight";
import { basicSetup } from "@codemirror/basic-setup";
import { indentWithTab } from "@codemirror/commands";

let theme = EditorView.theme({
  "&": {
    height: "100%"
  },
  "&.cm-focused": {
    outline: "0"
  },
  ".cm-scroller": {
    fontFamily: "Inconsolata, monospace",
  },
  ".cm-gutters": {
    background: "none",
    border: "none",
  },
  ".cm-highlight": {
    padding: "0 2px",
    margin: "-1px -2px",
    borderRadius: "2px",
  },
});

let nota_language = new LanguageSupport(
  LRLanguage.define({
    parser: parser.configure({
      props: [
        styleTags({
          Ident: t.definitionKeyword,
          CommandSigil: t.definitionKeyword,
          "{ }": t.brace,
          "[ ]": t.squareBracket,
        }),
      ],
    }),
  })
);

export let Editor = () => {
  let ref = useRef<HTMLDivElement>(null);
  let state = useContext(StateContext);

  useEffect(() => {
    let _editor = new EditorView({
      state: EditorState.create({
        doc: state.contents,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          EditorView.lineWrapping,
          nota_language,
          theme,
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              state.set_contents(update.state.doc.toJSON().join("\n"));
            }
          }),
        ],
      }),
      parent: ref.current!,
    });
  }, []);

  return <div ref={ref} />;
};
