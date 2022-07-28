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
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, KeyBinding, keymap } from "@codemirror/view";
import { isOk } from "@nota-lang/nota-common/dist/result";
import { nota } from "@nota-lang/nota-syntax/dist/editor/mod.js";
import classNames from "classnames";
import { basicSetup } from "codemirror";
import { action, reaction } from "mobx";
import React, { useContext, useEffect, useRef, useState } from "react";
//@ts-ignore
import sourceMapWasmUrl from "source-map/lib/mappings.wasm";

import { StateContext, TranslationResult } from ".";
import { indentationGuides } from "./indentation-guides.js";
//@ts-ignore
import { default as sourceMap } from "./source-map.js";

sourceMap.SourceMapConsumer.initialize({
  "lib/mappings.wasm": sourceMapWasmUrl,
});

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

let errorLine = Decoration.line({ class: "cm-error" });

let setErrorLines = StateEffect.define<{ lines: number[] }>();

let errorLineField = StateField.define<DecorationSet>({
  create: () => RangeSet.empty,
  update(lines, tr) {
    lines = lines.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(setErrorLines)) {
        lines = RangeSet.of(
          e.value.lines.map(i => {
            let line = tr.state.doc.line(i);
            return errorLine.range(line.from, line.from);
          })
        );
      }
    }
    return lines;
  },
  provide: f => EditorView.decorations.from(f),
});

export interface EditorProps {
  embedded?: boolean;
}

export let Editor: React.FC<EditorProps> = ({ embedded }) => {
  let ref = useRef<HTMLDivElement>(null);
  let state = useContext(StateContext)!;

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

    // TODO: errors should disappear (or be sticky?) once user makes edits

    let showSyntaxError = (translation: TranslationResult) => {
      if (!isOk(translation)) {
        console.log("TODO");
      }
    };

    let disposeSyntaxErrorHandler = reaction(() => state.translation, showSyntaxError, {
      fireImmediately: true,
    });

    let showRuntimeError = async (runtimeError: Error | undefined) => {
      if (!isOk(state.translation)) {
        console.log("race condition?");
        return;
      }

      let dispatchErrorLines = (lines: number[]) => {
        editor.dispatch({ effects: [setErrorLines.of({ lines })] });
      };

      if (!runtimeError) {
        dispatchErrorLines([]);
        return;
      }

      if (runtimeError.stack) {
        let lines = runtimeError.stack.split("\n");
        if (lines.length < 2) return;

        let lineInfo = lines[1].match(/\(([^:]*):(\d+):(\d+)\)$/)!;
        if (!lineInfo) {
          console.warn(`Could not match: ${lines[1]}`);
          return;
        }

        let sourceFile = lineInfo[1];
        let line = parseInt(lineInfo[2]);
        let column = parseInt(lineInfo[3]);

        let withConsumer = (consumer: any) => {
          // console.log(consumer, sourceFile, line, column);
          // consumer.eachMapping(m => console.log(m));

          let position = consumer.originalPositionFor({
            source: sourceFile,
            // -2 is because the JS evaluator adds an implicit 2 lines
            // above the body of the eval'd code
            line: line - 2,
            // -1 because... 1-index issue? not sure why this is needed,
            // but it seems to work with both babel and esbuild
            column: column - 1,
            bias: sourceMap.SourceMapConsumer.LEAST_UPPER_BOUND,
          });

          if (position.line !== null) {
            dispatchErrorLines([position.line]);
          } else {
            console.warn(
              `Could not find source-map position for location in error: "${lines[1].trim()}"`
            );
          }
        };
        await sourceMap.SourceMapConsumer.with(state.translation.value.map, null, withConsumer);
      }
    };

    let disposeRuntimeErrorHandler = reaction(() => state.runtimeError, showRuntimeError, {
      fireImmediately: true,
    });

    return () => {
      disposeSyntaxErrorHandler();
      disposeRuntimeErrorHandler();
      editor.destroy();
    };
  }, []);

  return <div className={classNames("nota-editor", { embedded })} ref={ref} />;
};
