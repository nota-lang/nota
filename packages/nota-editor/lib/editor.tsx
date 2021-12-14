import React, { useEffect, useRef, useContext } from "react";
import { action } from "mobx";
import { nota_language, js_language } from "@wcrichto/nota-syntax";
import { basicSetup, EditorView, EditorState } from "@codemirror/basic-setup";
import { keymap } from "@codemirror/view";
import { tags as t, HighlightStyle, defaultHighlightStyle } from "@codemirror/highlight";
import { indentWithTab } from "@codemirror/commands";

import { StateContext } from "./state";

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

export let Editor = () => {
  let ref = useRef<HTMLDivElement>(null);
  let state = useContext(StateContext)!;

  useEffect(() => {
    let lang_exts = [nota_language, js_language];
    let visual_exts = [/*defaultHighlightStyle,*/ theme, style, EditorView.lineWrapping];
    let editing_exts = [keymap.of([indentWithTab])];
    let custom_exts = [
      EditorView.updateListener.of(
        action(update => {
          if (update.docChanged) {
            state.contents = update.state.doc.toJSON().join("\n");
          }
        })
      ),
    ];
    let _editor = new EditorView({
      state: EditorState.create({
        doc: state.contents,
        extensions: [lang_exts, visual_exts, editing_exts, custom_exts, basicSetup],
      }),
      parent: ref.current!,
    });
  }, []);

  return <div ref={ref} />;
};
