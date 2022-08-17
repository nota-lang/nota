import {
  LanguageSupport,
  defaultHighlightStyle,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { EditorState, Extension, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, lineNumbers } from "@codemirror/view";
import { joinRecursive } from "@nota-lang/nota-common/dist/nota-text.js";
import { some } from "@nota-lang/nota-common/dist/option.js";
import _ from "lodash";
import React, { useEffect, useRef } from "react";

import { DefinitionsPlugin } from "./definitions.js";
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
    fontFamily: "var(--font-mono)",
  },
  ".cm-gutters": {
    background: "none",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    fontSize: "12px",
    paddingTop: "2px",
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
  delimiters: [string, string][]
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
  delimiters: [string, string][];
  onParse: (ranges: number[][]) => void;
}

export interface ListingProps {
  editable?: boolean;
  wrap?: boolean;
  language?: LanguageSupport | (() => LanguageSupport) | "text";
  onLoad?: (editor: EditorView) => void;
  delimiters?: ListingDelimiterProps;
  extensions?: Extension[];
  autodef?: { lang: string; prefix?: string } | string;
}

let autodefLangs: { [key: string]: { [node: string]: string } } = {
  rust: {
    TypeItem: "TypeIdentifier",
    TraitItem: "TypeIdentifier",
    StructItem: "TypeIdentifier",
    EnumItem: "TypeIdentifier",
    UnionItem: "TypeIdentifier",
    FunctionItem: "BoundIdentifier",
    LetDeclaration: "BoundIdentifier",
  },
};

export let Listing: FCC<ListingProps> = props => {
  let ctx = usePlugin(ListingPlugin);
  let defCtx = usePlugin(DefinitionsPlugin);
  let ref = useRef(null);

  useEffect(() => {
    let language: LanguageSupport | undefined;
    if (props.language) {
      if (props.language instanceof Function) {
        language = props.language();
      } else if (props.language === "text") {
        language = undefined;
      } else {
        language = props.language;
      }
    } else if (ctx.language) {
      language = ctx.language;
    }

    let children = props.children;
    if (!(typeof children === "string" || children instanceof Array)) {
      throw new Error(`Invalid input to listing: ${children?.toString()}`);
    }
    let code = joinRecursive(children);
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

    if (props.autodef) {
      let lang, prefix: string | undefined;
      if (typeof props.autodef === "string") {
        lang = props.autodef;
      } else {
        lang = props.autodef.lang;
        prefix = props.autodef.prefix;
      }

      let tree = syntaxTree(editor.state);
      let contents = editor.state.doc.sliceString(0);
      let defNodes = autodefLangs[lang];
      tree.iterate({
        enter(node) {
          if (node.name in defNodes) {
            let child = node.node.getChild(defNodes[node.name]);
            if (!child) return;
            let name = contents.slice(child.from, child.to);
            let fullName = (prefix || "") + name;
            let outer = contents.slice(node.from, node.to);
            defCtx.addDefinition(fullName, [], {
              tooltip: some(() => <pre>{outer}</pre>),
              label: some(() => <code>{name}</code>),
            });
          }
        },
      });
    }

    if (props.onLoad) {
      props.onLoad(editor);
    }

    if (props.delimiters) {
      props.delimiters.onParse(parseResult!.ranges!);
    }
  }, []);

  return <div className="listing" ref={ref} />;
};
