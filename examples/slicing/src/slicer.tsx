import React, { useState, useContext } from "react";
import {
  Listing,
  add_highlight,
  clear_highlights,
  linecol_to_pos,
  pos_to_linecol,
  Loader,
  LoaderContext,
  LoggerPlugin,
  usePlugin,
} from "nota";
import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import axios from "axios";

export let SliceListing: React.FC<{ code: string; prelude?: string }> = ({ code, prelude }) => (
  <Loader>
    {() => {
      let logger = usePlugin(LoggerPlugin);
      let loader = useContext(LoaderContext);

      let [editor, set_editor] = useState<EditorView | null>(null);

      let get_slice = async (range: number[]) => {
        if (!editor) {
          return;
        }

        editor.dispatch({
          effects: clear_highlights.of(null),
        });

        let program = [prelude || ""].concat(editor.state.doc.toJSON()).join("\n");
        program = `fn main() { ${program} }`
        let start = pos_to_linecol(editor, range[0]);
        let end = pos_to_linecol(editor, range[1]);

        if (start.line != end.line) {
          throw "Start line different from end line";
        }

        let request = { program, line: start.line, start: start.col, end: end.col };
        loader.set_loaded(false);
        let response = await axios.post("https://mindover.computer:3443", request);
        loader.set_loaded(true);

        if (response.data.error) {
          logger.log(
            () => (
              <pre className="textcolor-error" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {response.data.error}
              </pre>
            ),
            15000
          );
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

        let highlights = ranges
          .filter(range => range.filename.includes("main.rs"))
          .filter(
            range =>
              !(
                // Exclude sliced variable
                (
                  (range.start_line == request.line && range.start_col == request.start) ||
                  // Exclude slices in prelude
                  range.start_line == 0
                )
              )
          )
          .map(range => {
            let from = linecol_to_pos(editor!, {
              line: range.start_line,
              col: range.start_col,
            });
            let to = linecol_to_pos(editor!, {
              line: range.end_line,
              col: range.end_col,
            });
            return add_highlight.of({ from, to, color: "peach" });
          });

        highlights.push(
          add_highlight.of({
            from: range[0],
            to: range[1],
            color: "forest-green",
          })
        );

        editor.dispatch({
          effects: highlights,
          // TODO: this doesn't consistently remove the blue selection box
          selection: { anchor: editor.state.selection.main.from },
        });
      };

      return (
        <div>
          <Listing
            editable
            code={code}
            extensions={[
              EditorView.updateListener.of(update => {
                if (update.docChanged) {
                  editor!.dispatch({ effects: clear_highlights.of(null) });
                }
              }),
            ]}
            onLoad={e => {
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
              let selection = editor!.state.selection!;
              let range = selection.main;
              if (!range.empty) {
                get_slice([range.from, range.to]);
              } else {
                logger.log(() => "You have to select a variable to slice on.");
              }
            }}
          >
            Slice
          </button>
        </div>
      );
    }}
  </Loader>
);
