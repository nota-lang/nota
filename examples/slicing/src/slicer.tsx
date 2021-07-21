import React, { useState } from "react";
import {
  Listing,
  add_highlight,
  clear_highlights,
  linecol_to_pos,
  pos_to_linecol,
} from "reactex/dist/code";
import { EditorView } from "@codemirror/view";
import axios from "axios";

export let SliceListing: React.FC<{ code: string }> = ({ code }) => {
  let [editor, set_editor] = useState<EditorView | null>(null);

  let get_slice = async (range) => {
    editor!.dispatch({ effects: clear_highlights.of() });

    let program = editor!.state.doc.toJSON().join("\n");
    let start = pos_to_linecol(editor!, range[0]);
    let end = pos_to_linecol(editor!, range[1]);

    if (start.line != end.line) {
      throw "Start line different from end line";
    }

    let request = { program, line: start.line, start: start.col, end: end.col };
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
        .filter((range) => range.filename.includes("main.rs"))
        .filter(
          (range) =>
            !(
              range.start_line == request.line &&
              range.start_col == request.start
            )
        )
        .map((range) => {
          let from = linecol_to_pos(editor!, {
            line: range.start_line,
            col: range.start_col,
          });
          let to = linecol_to_pos(editor!, {
            line: range.end_line,
            col: range.end_col,
          });
          return add_highlight.of({ from, to, mark: "peach" });
        }),
    });

    editor!.dispatch({
      effects: [
        add_highlight.of({
          from: range[0],
          to: range[1],
          mark: "green",
        }),
      ],
    });
  };

  return (
    <div>
      <Listing
        editable
        code={code}
        extensions={[
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              editor!.dispatch({ effects: clear_highlights.of() });
            }
          }),
        ]}
        onLoad={(e) => {
          editor = e;
          set_editor(e);
        }}
        delimiters={{
          delimiters: [["@", "@"]],
          onParse: ([range]) => {
            get_slice(range);
          },
        }}
      />
      <button
        onClick={() => {
          let selection = editor!.state.selection;
          if (selection) {
            let range = selection.main;
            get_slice([range.from, range.to]);
          }
        }}
      >
        Slice
      </button>
    </div>
  );
};
