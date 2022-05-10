import React, { useEffect, useRef, useContext } from "react";
import { action } from "mobx";
import { nota /*CodeTag*/ } from "@nota-lang/nota-syntax";
import { basicSetup } from "@codemirror/basic-setup";
import { keymap, KeyBinding, EditorView } from "@codemirror/view";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { indentWithTab } from "@codemirror/commands";
import { EditorSelection, EditorState } from "@codemirror/state";
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

// Either adds an empty command at the cursor or wraps the selected text
// in a command.
let insertCommandAtCursor = (key: string, cmd: string): KeyBinding => ({
  key,
  run({ state, dispatch }) {
    let changes = state.changeByRange(range => {
      let anchor = range.from + 2 + cmd.length;
      if (range.empty) {
        return {
          changes: [
            {
              from: range.from,
              insert: `@${cmd}{}`,
            },
          ],
          range: EditorSelection.cursor(anchor),
        };
      } else {
        let changes = [
          {
            from: range.from,
            insert: `@${cmd}{`,
          },
          {
            from: range.to,
            insert: `}`,
          },
        ];
        return {
          changes,
          range: EditorSelection.range(anchor, anchor + range.head - range.anchor),
        };
      }
    });
    dispatch(state.update(changes));
    return true;
  },
});

let keyBindings: KeyBinding[] = [
  insertCommandAtCursor("Mod-b", "strong"),
  insertCommandAtCursor("Mod-i", "em"),
  insertCommandAtCursor("Mod-u", "u"),
  insertCommandAtCursor("Mod-k", "a"),
  insertCommandAtCursor("Ctrl-1", "Section"),
  insertCommandAtCursor("Ctrl-2", "Subsection"),
  insertCommandAtCursor("Ctrl-3", "Subsubsection"),
];

let notaLang = nota();

export interface EditorProps {
  embedded?: boolean;
}

export let Editor: React.FC<EditorProps> = ({ embedded }) => {
  let ref = useRef<HTMLDivElement>(null);
  let state = useContext(StateContext)!;

  useEffect(() => {
    let visualExts = [
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.lineWrapping,
      theme,
    ];
    let editingExts = [keymap.of([...keyBindings, indentWithTab])];
    let customExts = [
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
        extensions: [notaLang, visualExts, editingExts, customExts, basicSetup],
      }),
      parent: ref.current!,
    });
  }, []);

  return <div className={classNames("nota-editor", { embedded })} ref={ref} />;
};
