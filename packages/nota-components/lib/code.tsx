import React, { useRef, useEffect } from "react";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { lineNumbers } from "@codemirror/gutter";
import { defaultHighlightStyle } from "@codemirror/highlight";
import { LanguageSupport } from "@codemirror/language";
import { EditorState, StateField, StateEffect, Extension } from "@codemirror/state";
import { Plugin, usePlugin, Pluggable } from "./plugin";
import _ from "lodash";
import { join_recursive } from "@wcrichto/nota-common";

export const add_highlight = StateEffect.define<{ from: number; to: number; color: string }>();

export const clear_highlights = StateEffect.define();

const highlight_field = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(highlights, tr) {
    highlights = highlights.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(add_highlight)) {
        let { to, from, color } = e.value;
        let mark = Decoration.mark({
          class: `cm-highlight bgcolor-${color}`,
        });
        highlights = highlights.update({
          add: [mark.range(from, to)],
        });
      } else if (e.is(clear_highlights)) {
        return highlights.update({ filter: _ => false });
      }
    }
    return highlights;
  },
  provide: f => EditorView.decorations.from(f),
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
    padding: "0 2px",
    margin: "-1px -2px",
    borderRadius: "2px",
  },
});

interface Linecol {
  line: number;
  col: number;
}

export let linecol_to_pos = (editor: EditorView, { line, col }: Linecol): number => {
  let line_obj = editor.state.doc.line(line);
  return line_obj.from + col;
};

export let pos_to_linecol = (editor: EditorView, pos: number): Linecol => {
  let line_obj = editor.state.doc.lineAt(pos);
  return {
    line: line_obj.number,
    col: pos - line_obj.from,
  };
};

export let ListingPlugin = new Plugin(
  class extends Pluggable {
    language?: LanguageSupport;
  }
);

export let ListingConfigure: React.FC<{ language?: LanguageSupport }> = ({ language }) => {
  let ctx = usePlugin(ListingPlugin);
  ctx.language = language;
  return null;
};

let parse_with_delimiters = (
  code: string,
  delimiters: string[][]
): { output_code?: string; ranges?: number[][]; error?: string } => {
  let [open, close] = _.unzip(delimiters);
  let make_check = (arr: string[]) => {
    let r = new RegExp(`^${arr.join("|")}`);
    return (s: string) => {
      let match = s.match(r);
      return match ? match[0].length : null;
    };
  };
  let [open_check, close_check] = [make_check(open), make_check(close)];

  let index = 0;
  let in_seq = null;
  let ranges = [];
  let output_code = [];
  let i = 0;
  while (i < code.length) {
    if (in_seq === null) {
      let n = open_check(code.substring(i));
      if (n) {
        i += n;
        in_seq = index;
        continue;
      }
    } else {
      let n = close_check(code.substring(i));
      if (n) {
        i += n;
        ranges.push([in_seq!, index]);
        in_seq = null;
        continue;
      }
    }

    index += 1;
    output_code.push(code[i]);
    i += 1;
  }

  return { output_code: output_code.join(""), ranges };
};

export interface ListingDelimiterProps {
  delimiters: string[][];
  onParse: (_ranges: number[][]) => void;
}

export interface ListingProps {
  editable?: boolean;
  language?: LanguageSupport;
  onLoad?: (_editor: EditorView) => void;
  delimiters?: ListingDelimiterProps;
  extensions?: Extension[];
}

export let Listing: React.FC<ListingProps> = props => {
  let ctx = usePlugin(ListingPlugin);
  let ref = useRef(null);

  useEffect(() => {
    let language = props.language || ctx.language;

    let code = join_recursive(props.children as any);
    let parse_result = null;
    if (props.delimiters) {
      parse_result = parse_with_delimiters(code, props.delimiters.delimiters);
      if (parse_result.error) {
        throw parse_result.error;
      } else {
        code = parse_result.output_code!;
      }
    }

    let editor = new EditorView({
      state: EditorState.create({
        doc: code,
        extensions: [
          lineNumbers(),
          defaultHighlightStyle,
          theme,
          EditorView.editable.of(props.editable || false),
          highlight_field,
        ]
          .concat(language ? [language] : [])
          .concat(props.extensions || []),
      }),
      parent: ref.current!,
    });

    if (props.onLoad) {
      props.onLoad(editor);
    }

    if (props.delimiters) {
      props.delimiters.onParse(parse_result!.ranges!);
    }
  }, []);

  return <div ref={ref} />;
};
