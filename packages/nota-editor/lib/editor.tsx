import { basicSetup } from "@codemirror/basic-setup";
import { indentWithTab } from "@codemirror/commands";
import {
  LanguageDescription,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  EditorState as CmEditorState,
  EditorSelection,
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  KeyBinding,
  ViewPlugin,
  keymap,
} from "@codemirror/view";
import { nota } from "@nota-lang/nota-syntax/dist/editor/mod.js";
import classNames from "classnames";
import { action, makeAutoObservable, reaction } from "mobx";
import React, { useContext, useEffect, useRef, useState } from "react";

import { StateContext } from ".";
import { indentationGuides } from "./indentation-guides.js";

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
  ".cm-error": {
    background: "rgba(255, 0, 0, 0.12)",
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
          changes: [{ from: range.from, insert: `@${cmd}{}` }],
          range: EditorSelection.cursor(anchor),
        };
      } else {
        let changes = [
          { from: range.from, insert: `@${cmd}{` },
          { from: range.to, insert: `}` },
        ];
        let newRange = EditorSelection.range(anchor, anchor + range.head - range.anchor);
        return { changes, range: newRange };
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

export class EditorState {
  error?: {
    line: number;
  } = undefined;

  constructor() {
    makeAutoObservable(this);
  }
}

let errorLine = Decoration.line({ class: "cm-error" });

let clearErrorLine = StateEffect.define<null>();
let setErrorLine = StateEffect.define<{ line: number }>();

let errorLineField = StateField.define<DecorationSet>({
  create: () => RangeSet.empty,
  update(lines, tr) {
    lines = lines.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(setErrorLine)) {
        let line = tr.state.doc.line(e.value.line);
        lines = RangeSet.of([errorLine.range(line.from, line.from)]);
      } else if (e.is(clearErrorLine)) {
        lines = RangeSet.empty;
      }
    }
    return lines;
  },
  provide: f => EditorView.decorations.from(f),
});

export let EditorStateContext = React.createContext<EditorState | null>(null);

export interface EditorProps {
  embedded?: boolean;
}

export let Editor: React.FC<EditorProps> = ({ embedded }) => {
  let ref = useRef<HTMLDivElement>(null);
  let state = useContext(StateContext)!;
  let editorState = useContext(EditorStateContext)!;

  let [notaLang] = useState(() =>
    nota({
      codeLanguages: (name: string) => {
        if (name in state.availableLanguages) {
          let support = state.availableLanguages[name];
          return LanguageDescription.of({ name, support });
        } else {
          return null;
        }
      },
    })
  );

  useEffect(() => {
    let visualExts = [
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.lineWrapping,
      theme,
      indentationGuides(),
    ];
    let editingExts = [keymap.of([...keyBindings, indentWithTab]), CmEditorState.tabSize.of(2)];
    let customExts = [
      EditorView.updateListener.of(
        action(update => {
          if (update.docChanged) {
            state.contents = update.state.doc.toJSON().join("\n");
          }
        })
      ),
      errorLineField,
    ];
    let editor = new EditorView({
      state: CmEditorState.create({
        doc: state.contents,
        extensions: [notaLang, visualExts, editingExts, customExts, basicSetup],
      }),
      parent: ref.current!,
    });

    return reaction(
      () => editorState.error,
      error => {
        let effects = [error ? setErrorLine.of(error) : clearErrorLine.of(null)];
        console.log(error, effects);
        editor.dispatch({ effects });
      }
    );
  }, []);

  return <div className={classNames("nota-editor", { embedded })} ref={ref} />;
};
