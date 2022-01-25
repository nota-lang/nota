import React, { useEffect, useRef, useContext } from "react";
import { action } from "mobx";
import { nota /*CodeTag*/ } from "@nota-lang/nota-syntax";
import { basicSetup, EditorView, EditorState } from "@codemirror/basic-setup";
import { keymap, KeyBinding } from "@codemirror/view";
import { defaultHighlightStyle } from "@codemirror/highlight";
import { indentWithTab } from "@codemirror/commands";
import classNames from "classnames";

import { StateContext } from ".";
import { EditorSelection } from "@codemirror/state";

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
let insert_command_at_cursor = (key: string, cmd: string): KeyBinding => ({
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

let key_bindings: KeyBinding[] = [
  insert_command_at_cursor("Mod-b", "strong"),
  insert_command_at_cursor("Mod-i", "em"),
  insert_command_at_cursor("Mod-u", "u"),
  insert_command_at_cursor("Mod-k", "a"),
  insert_command_at_cursor("Ctrl-1", "Section"),
  insert_command_at_cursor("Ctrl-2", "Subsection"),
  insert_command_at_cursor("Ctrl-3", "Subsubsection"),
];

let nota_lang = nota();

export interface EditorProps {
  embedded?: boolean;
}

export let Editor: React.FC<EditorProps> = ({ embedded }) => {
  let ref = useRef<HTMLDivElement>(null);
  let state = useContext(StateContext)!;

  useEffect(() => {
    let visual_exts = [defaultHighlightStyle, EditorView.lineWrapping, theme];
    let editing_exts = [keymap.of([...key_bindings, indentWithTab])];
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
        extensions: [nota_lang, visual_exts, editing_exts, custom_exts, basicSetup],
      }),
      parent: ref.current!,
    });
  }, []);

  return <div className={classNames("nota-editor", { embedded })} ref={ref} />;
};
