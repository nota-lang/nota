import { LanguageSupport, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, Extension, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, lineNumbers } from "@codemirror/view";
import { joinRecursive } from "@nota-lang/nota-common/dist/nota-text.js";
import _ from "lodash";
import React, { useEffect, useRef } from "react";

import { Pluggable, Plugin, usePlugin } from "./plugin.js";
import { FCC } from "./utils.js";

export const addHighlight = StateEffect.define<{ from: number; to: number; color: string }>();

export const clearHighlights = StateEffect.define();

const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(highlights, tr) {
    highlights = highlights.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(addHighlight)) {
        let { to, from, color } = e.value;
        let mark = Decoration.mark({
          class: `cm-highlight bgcolor-${color}`,
        });
        highlights = highlights.update({
          add: [mark.range(from, to)],
        });
      } else if (e.is(clearHighlights)) {
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

export let linecolToPos = (editor: EditorView, { line, col }: Linecol): number => {
  let lineObj = editor.state.doc.line(line);
  return lineObj.from + col;
};

export let posToLinecol = (editor: EditorView, pos: number): Linecol => {
  let lineObj = editor.state.doc.lineAt(pos);
  return {
    line: lineObj.number,
    col: pos - lineObj.from,
  };
};

export let ListingPlugin = new Plugin(
  class extends Pluggable {
    language?: LanguageSupport;
    wrap?: boolean;
  }
);

export let ListingConfigure: React.FC<{ language?: LanguageSupport; wrap?: boolean }> = ({
  language,
  wrap,
}) => {
  let ctx = usePlugin(ListingPlugin);
  ctx.language = language;
  ctx.wrap = wrap;
  return null;
};

let parseWithDelimiters = (
  code: string,
  delimiters: string[][]
): { outputCode?: string; ranges?: number[][]; error?: string } => {
  let [open, close] = _.unzip(delimiters);
  let makeCheck = (arr: string[]) => {
    let r = new RegExp(`^${arr.join("|")}`);
    return (s: string) => {
      let match = s.match(r);
      return match ? match[0].length : null;
    };
  };
  let [openCheck, closeCheck] = [makeCheck(open), makeCheck(close)];

  let index = 0;
  let inSeq = null;
  let ranges = [];
  let outputCode = [];
  let i = 0;
  while (i < code.length) {
    if (inSeq === null) {
      let n = openCheck(code.substring(i));
      if (n) {
        i += n;
        inSeq = index;
        continue;
      }
    } else {
      let n = closeCheck(code.substring(i));
      if (n) {
        i += n;
        ranges.push([inSeq!, index]);
        inSeq = null;
        continue;
      }
    }

    index += 1;
    outputCode.push(code[i]);
    i += 1;
  }

  return { outputCode: outputCode.join(""), ranges };
};

export interface ListingDelimiterProps {
  delimiters: string[][];
  onParse: (ranges: number[][]) => void;
}

export interface ListingProps {
  editable?: boolean;
  wrap?: boolean;
  language?: LanguageSupport | (() => LanguageSupport);
  onLoad?: (editor: EditorView) => void;
  delimiters?: ListingDelimiterProps;
  extensions?: Extension[];
}

export let Listing: FCC<ListingProps> = props => {
  let ctx = usePlugin(ListingPlugin);
  let ref = useRef(null);

  useEffect(() => {
    let language: LanguageSupport | undefined;
    if (props.language) {
      if (props.language instanceof Function) {
        language = props.language();
      } else {
        language = props.language;
      }
    } else if (ctx.language) {
      language = ctx.language;
    }

    let code = joinRecursive(props.children as any);
    let parseResult = null;
    if (props.delimiters) {
      parseResult = parseWithDelimiters(code, props.delimiters.delimiters);
      if (parseResult.error) {
        throw parseResult.error;
      } else {
        code = parseResult.outputCode!;
      }
    }

    let editor = new EditorView({
      state: EditorState.create({
        doc: code,
        extensions: [
          lineNumbers(),
          syntaxHighlighting(defaultHighlightStyle),
          theme,
          EditorView.editable.of(props.editable || false),
          props.wrap || ctx.wrap ? EditorView.lineWrapping : [],
          highlightField,
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
      props.delimiters.onParse(parseResult!.ranges!);
    }
  }, []);

  return <div className="listing block" ref={ref} />;
};
