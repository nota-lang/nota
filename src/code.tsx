import React, { useRef, useEffect, useContext, useState } from "react";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { lineNumbers } from "@codemirror/gutter";
import { defaultHighlightStyle } from "@codemirror/highlight";
import { LanguageSupport } from "@codemirror/language";
import { EditorState, StateField, StateEffect } from "@codemirror/state";
import _ from "lodash";
import axios from "axios";

const add_highlight =
  StateEffect.define<{ from: number; to: number; mark: string }>();

const highlight_marks = _.fromPairs(
  ["peach", "green"].map((color) => [
    color,
    Decoration.mark({ class: `cm-highlight hl-${color}` }),
  ])
);

const highlight_field = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(highlights, tr) {
    highlights = highlights.map(tr.changes);
    tr.effects.forEach((e) => {
      if (e.is(add_highlight)) {
        let mark = highlight_marks[e.value.mark];
        if (!mark) {
          throw `Missing mark "${e.value.mark}"`;
        }

        highlights = highlights.update({
          add: [mark.range(e.value.from, e.value.to)],
        });
      }
    });
    return highlights;
  },
  provide: (f) => EditorView.decorations.from(f),
});

let theme = EditorView.theme({
  ".cm-scroller": {
    fontFamily: "Inconsolata, monospace",
  },
  ".cm-gutters": {
    background: "none",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    fontSize: "10px",
    paddingTop: "3px",
    paddingRight: "7px",
    minWidth: "10px",
  },
  ".cm-highlight": {
    padding: "0 3px",
    margin: "-1px -3px",
    borderRadius: "2px",
  },
  ".hl-peach": {
    background: "rgb(250,223,203)",
  },
  ".hl-green": {
    background: "rgb(186,220,199)"
  },
});

export class ListingData {
  language?: LanguageSupport;
}

export let ListingContext = React.createContext<ListingData>(new ListingData());

export let ListingConfigure: React.FC<{ language?: LanguageSupport }> = ({
  language,
}) => {
  let ctx = useContext(ListingContext);
  ctx.language = language;
  return null;
};

export let Listing: React.FC<{ code: string; language?: LanguageSupport }> = (props) => {
  let [editor, set_editor] = useState<EditorView | null>(null);
  let ctx = useContext(ListingContext);
  let ref = useRef(null);

  useEffect(() => {
    let language = props.language || ctx.language;
    if (!language) {
      throw 'Language not specified !!!!';
    }

    let editor = new EditorView({
      state: EditorState.create({
        doc: props.code,
        extensions: [
          lineNumbers(),
          defaultHighlightStyle,
          language,
          theme,
          EditorView.editable.of(false),
          highlight_field,
        ],
      }),
      parent: ref.current!,
    });
    set_editor(editor);

    // editor.dispatch({ effects: [add_highlight.of({ from: 0, to: 5, mark: 'peach' })] });
  }, []);

  let linecol_to_byte = (line_num: number, col: number) => {
    let line = editor!.state.doc.line(line_num);
    return line.from + col;
  };

  return (
    <>
      <div ref={ref} />
      <button
        onClick={async () => {
          let program = editor!.state.doc.toJSON().join("\n");
          let request = { program, line: 5, start: 15, end: 16 };
          let response = await axios.post(
            "http://charlotte.stanford.edu:8889",
            request
          );

          interface Range {
            start_line: number;
            start_col: number;
            end_line: number;
            end_col: number;
            filename: string;
          }
          let ranges: Range[] = response.data.ranges;

          editor!.dispatch({
            effects: ranges
              .filter(range => range.filename.includes("main.rs"))
              .filter(range => !(range.start_line == request.line && range.start_col == request.start))
              .map(range => {
                let from = linecol_to_byte(range.start_line, range.start_col);
                let to = linecol_to_byte(range.end_line, range.end_col);
                return add_highlight.of({ from, to, mark: "peach" });
              }),
          });          
          
          editor!.dispatch({
            effects: [add_highlight.of({
              from: linecol_to_byte(request.line, request.start),
              to: linecol_to_byte(request.line, request.end),
              mark: "green"
            })]
          });
        }}
      >
        Click
      </button>
    </>
  );
};
