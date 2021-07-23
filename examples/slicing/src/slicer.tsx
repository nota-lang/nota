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

export let SliceListing: React.FC<{ code: string; prelude?: string }> = ({
  code,
  prelude,
}) => {
  let [editor, set_editor] = useState<EditorView | null>(null);

  let get_slice = async (range: number[]) => {
    editor!.dispatch({ effects: clear_highlights.of(null) });

    let program = [prelude || ''].concat(editor!.state.doc.toJSON()).join("\n");
    let start = pos_to_linecol(editor!, range[0]);
    let end = pos_to_linecol(editor!, range[1]);
    start.line += 1;
    end.line += 1;

    if (start.line != end.line) {
      throw "Start line different from end line";
    }

    let request = { program, line: start.line, start: start.col, end: end.col };
    let response = await axios.post(
      "http://charlotte.stanford.edu:8889",
      request
    );

    if (response.data.error) {
      console.error(response.data.error);
      return;
    }

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
              // Exclude sliced variable
              (range.start_line == request.line &&
              range.start_col == request.start) ||
              // Exclude slices in prelude
              (range.start_line == 1)
            )
        )
        .map((range) => {
          let from = linecol_to_pos(editor!, {
            line: range.start_line - 1,
            col: range.start_col,
          });
          let to = linecol_to_pos(editor!, {
            line: range.end_line - 1,
            col: range.end_col,
          });
          return add_highlight.of({ from, to, color: "peach" });
        }),
    });

    editor!.dispatch({
      effects: [
        add_highlight.of({
          from: range[0],
          to: range[1],
          color: "forest-green",
        }),
      ],
    });
  };

  // TODO:
  //   1. loading animation
  //   2. error messages for compile fail
  //   3. error messages for no selected range

  return (
    <div>
      <Listing
        editable
        code={code}
        extensions={[
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              editor!.dispatch({ effects: clear_highlights.of(null) });
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
      {/* <button
        onClick={() => {
          let selection = editor!.state.selection!;
          let range = selection.main;
          if (!range.empty) {
            get_slice([range.from, range.to]);
          }
        }}
      >
        Slice
      </button> */}
    </div>
  );
};
