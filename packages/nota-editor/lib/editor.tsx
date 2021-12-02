import React, { useEffect, useRef, useContext } from "react";
import { action } from "mobx";
import { parser } from "@wcrichto/nota-syntax";
import { StateContext } from "./state";
import { basicSetup, EditorView, EditorState } from "@codemirror/basic-setup";
import { keymap } from "@codemirror/view";
import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags as t, HighlightStyle, defaultHighlightStyle } from "@codemirror/highlight";
import { indentWithTab } from "@codemirror/commands";

const style = HighlightStyle.define([
  { tag: t.string, fontFamily: "Linux Libertine O, serif" },
  { tag: t.variableName, color: "#164" },
  { tag: t.definitionKeyword, color: "#219" },
  { tag: t.comment, color: "#940" },
]);

export let theme = EditorView.theme({
  "&": {
    height: "100%",
  },
  "&.cm-focused": {
    outline: "0",
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
          Text: t.string,
          Ident: t.definitionKeyword,
          Number: t.definitionKeyword,
          "CommandNamedArg/Ident": t.variableName,
          At: t.definitionKeyword,
          Pct: t.definitionKeyword,
          Hash: t.definitionKeyword,
          "{ }": t.brace,
          "[ ]": t.squareBracket,
        }),
      ],
    }),
  })
);

export let Editor = () => {
  let ref = useRef<HTMLDivElement>(null);
  let state = useContext(StateContext)!;

  useEffect(() => {
    let _editor = new EditorView({
      state: EditorState.create({
        doc: state.contents,
        extensions: [
          basicSetup,
          style,
          keymap.of([indentWithTab]),
          EditorView.lineWrapping,
          nota_language,
          theme,
          EditorView.updateListener.of(
            action(update => {
              if (update.docChanged) {
                state.contents = update.state.doc.toJSON().join("\n");
              }
            })
          ),
        ],
      }),
      parent: ref.current!,
    });
  }, []);

  return <div ref={ref} />;
};
