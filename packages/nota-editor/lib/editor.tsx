import React, { useEffect, useRef, useContext } from "react";
import { action } from "mobx";
import { nota /*CodeTag*/ } from "@nota-lang/nota-syntax";
import { basicSetup, EditorView, EditorState } from "@codemirror/basic-setup";
import { keymap } from "@codemirror/view";
import { defaultHighlightStyle } from "@codemirror/highlight";
import { indentWithTab } from "@codemirror/commands";
import classNames from "classnames";

import { StateContext } from ".";

export let theme = EditorView.theme({
  "&": {
    height: "100%",
    textAlign: "left",
  },
  "&.cm-editor.cm-focused": {
    outline: "0",
  },
  ".cm-scroller": {
    fontFamily: "Inconsolata, monospace",
    lineHeight: "1.3",
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

let nota_lang = nota();

export interface EditorProps {
  embedded?: boolean;
}

export let Editor: React.FC<EditorProps> = ({ embedded }) => {
  let ref = useRef<HTMLDivElement>(null);
  let state = useContext(StateContext)!;

  useEffect(() => {
    let visual_exts = [defaultHighlightStyle, EditorView.lineWrapping, theme];
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
        extensions: [basicSetup, nota_lang, visual_exts, editing_exts, custom_exts],
      }),
      parent: ref.current!,
    });
  }, []);

  return <div className={classNames("nota-editor", { embedded })} ref={ref} />;
};
