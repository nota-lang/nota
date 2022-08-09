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
  SelectionRange,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, KeyBinding, keymap } from "@codemirror/view";
import * as icons from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon as Icon } from "@fortawesome/react-fontawesome";
import { isOk } from "@nota-lang/nota-common/dist/result";
import { ComponentMeta, componentMeta } from "@nota-lang/nota-components/dist/component-meta.js";
import { nota } from "@nota-lang/nota-syntax/dist/editor/mod.js";
import classNames from "classnames";
import { basicSetup } from "codemirror";
import { action, reaction, runInAction } from "mobx";
import { observer, useLocalObservable } from "mobx-react";
import React, { useContext, useEffect, useRef, useState } from "react";
//@ts-ignore
import sourceMapWasmUrl from "source-map/lib/mappings.wasm";

import { State, StateContext, TranslationResult } from ".";
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

let capitalize = (s: string): string => s[0].toUpperCase() + s.slice(1);

type CreateInsertion = (range: SelectionRange) => { before: string; after: string };
function insertAtSelection(editor: EditorView, getTextToInsert: CreateInsertion) {
  editor.dispatch(
    editor.state.changeByRange(range => {
      let { before, after } = getTextToInsert(range);
      let anchor = range.from + before.length;
      if (range.empty) {
        return {
          changes: [{ from: range.from, insert: before + after }],
          range: EditorSelection.cursor(anchor),
        };
      } else {
        let changes = [
          { from: range.from, insert: before },
          { from: range.to, insert: after },
        ];
        let newRange = EditorSelection.range(anchor, anchor + range.head - range.anchor);
        return { changes, range: newRange };
      }
    })
  );
}

function insertComponent(editor: EditorView, { name, props }: ComponentMeta) {
  insertAtSelection(editor, range => {
    let doc = editor.state.doc;
    let startLine = doc.lineAt(range.from);
    let endLine = doc.lineAt(range.to);
    let block = range.from == startLine.from && (range.empty || range.to == endLine.to);

    let before = `@${name}`;
    let requiredProps = props.filter(({ required }) => required);
    if (requiredProps.length > 0) {
      let propNames = requiredProps.map(({ name }) => `${name}: undefined`).join(", ");
      before += `[${propNames}]`;
    }

    let after;
    if (block) {
      let match = startLine.text.match(/^\s*/);
      let baseIndent = match ? match[0].length : 0;
      let newIndent = baseIndent + 2;
      before += `:\n${" ".repeat(newIndent)}`;
      after = "\n";
    } else {
      before += "{";
      after = "}";
    }

    return { before, after };
  });
}

let builtinActions = {
  bold: () => ({ before: "**", after: "**" }),
  italic: () => ({ before: "*", after: "*" }),
  underline: () => ({ before: "@u{", after: "}" }),
};

let makeBinding = (key: string, getTextToInsert: CreateInsertion): KeyBinding => ({
  key,
  run(editor) {
    insertAtSelection(editor, getTextToInsert);
    return true;
  },
});

let keyBindings: KeyBinding[] = [
  makeBinding("Mod-b", builtinActions.bold),
  makeBinding("Mod-i", builtinActions.italic),
  makeBinding("Mod-u", builtinActions.underline),
];

interface ViewState {
  showComponents: boolean;
  editor: EditorView | null;
}

let ComponentToolbar = ({ viewState }: { viewState: ViewState }) => {
  let [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="components-panel">
      {selected ? (
        <>
          <div className="subpanel">
            {(() => {
              let { members } = componentMeta.find(({ module }) => module == selected)!;
              return members
                .filter(({ exportType }) => exportType == "component")
                .map((meta, i) => (
                  <>
                    {i > 0 ? <div className="divider" /> : null}
                    <div
                      className="component"
                      key={i}
                      onClick={action(() => {
                        viewState.showComponents = false;
                        insertComponent(viewState.editor!, meta as ComponentMeta);
                      })}
                    >
                      <div>
                        <code>@{meta.name}</code>
                      </div>
                      <div className="comment">{meta.comment}</div>
                    </div>
                  </>
                ));
            })()}
          </div>
          <div className="divider" />
        </>
      ) : null}
      <div className="subpanel">
        {componentMeta
          .filter(
            ({ members }) =>
              members.filter(({ exportType }) => exportType == "component").length > 0
          )
          .map(({ module, comment }, i) => (
            <>
              {i > 0 ? <div className="divider" /> : null}
              <div
                className={classNames("module", { selected: selected == module })}
                key={module}
                onClick={() => setSelected(selected == module ? null : module)}
              >
                <div className="name">{capitalize(module)}</div>
                <div className="comment">{comment}</div>
              </div>
            </>
          ))}
      </div>
    </div>
  );
};

// TODO: rest of the buttons
// need to do the list thing where if you click in the middle of the text, it adds "*" at the beginning of line
// also need to toggle, not just add
let EditorToolbar = ({ viewState }: { viewState: ViewState }) => {
  let applyAction = (f: CreateInsertion) => () => insertAtSelection(viewState.editor!, f);
  return (
    <div className="editor-toolbar">
      <div className="buttons">
        <button onClick={applyAction(builtinActions.bold)}>
          <Icon icon={icons.faBold} />
        </button>
        <button onClick={applyAction(builtinActions.italic)}>
          <Icon icon={icons.faItalic} />
        </button>
        {/* <button>
          <Icon icon={icons.faList} />
        </button>
        <button>
          <Icon icon={icons.faListNumeric} />
        </button>
        <button>
          <Icon icon={icons.faCode} />
        </button>
        <button>JS</button> */}
        <button
          style={{ marginLeft: "auto" }}
          onClick={action(() => {
            viewState.showComponents = !viewState.showComponents;
          })}
        >
          <Icon icon={icons.faAt} />
        </button>
      </div>
    </div>
  );
};

export let Editor: React.FC<EditorProps> = observer(({ embedded }) => {
  let ref = useRef<HTMLDivElement>(null);
  let state = useContext(StateContext)!;
  let viewState = useLocalObservable<ViewState>(() => ({
    showComponents: false,
    editor: null,
  }));

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
    runInAction(() => {
      viewState.editor = editor;
    });

    // TODO: errors should disappear (or be sticky?) once user makes edits
    let showSyntaxError = (translation: TranslationResult) => {
      if (!isOk(translation)) {
        // TODO: show syntax errors
      }
    };

    let disposeSyntaxErrorHandler = reaction(() => state.translation, showSyntaxError, {
      fireImmediately: true,
    });

    let disposeRuntimeErrorHandler = reaction(
      () => state.runtimeError,
      runtimeError => showRuntimeError(state, editor, runtimeError),
      {
        fireImmediately: true,
      }
    );

    return () => {
      disposeSyntaxErrorHandler();
      disposeRuntimeErrorHandler();
      editor.destroy();
    };
  }, []);

  return (
    <div className={classNames("nota-editor", { embedded })}>
      <EditorToolbar viewState={viewState} />
      <div className="editor-wrapper">
        <div className="editor-el" ref={ref} />
        {viewState.showComponents ? <ComponentToolbar viewState={viewState} /> : null}
      </div>
    </div>
  );
});

let showRuntimeError = async (
  state: State,
  editor: EditorView,
  runtimeError: Error | undefined
) => {
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
