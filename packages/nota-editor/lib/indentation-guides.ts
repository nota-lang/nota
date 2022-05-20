/// Adapted from https://gist.github.com/s-cork/898cd7c21e55a4963132cb9d9e2c6615
import { Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import _ from "lodash";

export function indentationGuides(): Extension {
  return [showIndentations, indentationTheme];
}

// markers can be used at positions on a line over a range
const indentationMark = Decoration.mark({ class: "cm-indentation-guide" });
const indentationLevelMarks = _.range(20).map(i =>
  Decoration.line({ class: `cm-indentation-level-${i}` })
);

// widget are used for space only lines when we need to fill
// the indentation guides on parts of the line that don't exist
class IndentationWidget extends WidgetType {
  constructor(readonly indents: number[]) {
    super();
  }

  static create(indents: number[]) {
    return Decoration.widget({
      widget: new IndentationWidget(indents),
      side: 1,
    });
  }

  toDOM() {
    let wrap = document.createElement("span");
    wrap.className = "cm-indentation-widget";
    for (let indent of this.indents) {
      const marker = wrap.appendChild(document.createElement("span"));
      marker.className = "cm-indentation-guide";
      marker.textContent = " ".repeat(indent);
    }
    return wrap;
  }
}

const SPACES = /^\s*/;

function getCodeStart(text: string) {
  return text.match(SPACES)![0].length;
}

function makeIndentationMark(
  from: number,
  to: number,
  indent: number,
  tabSize: number,
  builder: RangeSetBuilder<Decoration>
) {
  builder.add(from, from, indentationLevelMarks[indent / tabSize]);
  for (let i = from; i < Math.min(from + indent, to); i += tabSize) {
    builder.add(i, i + 1, indentationMark);
  }
}

function makeIndentationWidget(
  from: number,
  to: number,
  indent: number,
  tabSize: number,
  builder: RangeSetBuilder<Decoration>
) {
  const length = to - from;
  if (indent <= length) {
    // we only add widgets when the line length is less than the indentation guide
    // if the indent <= length we just use the indentationMark
    return;
  }
  const indents = [];
  const toFill = indent - length;
  let initialFill = toFill % tabSize;
  if (length < tabSize) {
    initialFill += length ? tabSize : 2 * tabSize;
  }
  if (initialFill) {
    indents.push(initialFill);
  }
  const quotient = (toFill - initialFill) / tabSize;
  indents.push(...Array(quotient).fill(tabSize));
  builder.add(to, to, IndentationWidget.create(indents));
}

function makeIndentationDecorators(view: EditorView) {
  let builder = new RangeSetBuilder<Decoration>();
  const tabSize = Number(view.state.tabSize);
  const doc = view.state.doc;
  const spaceOnlyLines = [];
  let currentIndent = 0;
  for (let { from: visibleFrom, to: visibleTo } of view.visibleRanges) {
    let to = visibleFrom - 1;
    let pos, from, length, text;
    while ((pos = to + 1) <= visibleTo) {
      ({ from, to, length, text } = doc.lineAt(pos));
      const codeStartsAt = getCodeStart(text);
      const isAllSpaces = codeStartsAt === length;
      // we don't have indentation guides for the zero indentation level
      const skipIndent = codeStartsAt < tabSize;
      const isComment = text[codeStartsAt] == "/"; /** @todo for other languages */
      if (isAllSpaces) {
        spaceOnlyLines.push({ from, to });
        continue;
      } else if (skipIndent) {
        spaceOnlyLines.length = 0;
        continue;
      }
      // we have a valid indentation that needs guiding!
      // fill all space only lines that we've kept track of
      const indent = codeStartsAt - (codeStartsAt % tabSize);
      if (!isComment) {
        currentIndent = indent;
      }
      for (const { from, to } of spaceOnlyLines) {
        makeIndentationMark(from, to, currentIndent, tabSize, builder);
        makeIndentationWidget(from, to, currentIndent, tabSize, builder);
      }
      spaceOnlyLines.length = 0;
      console.log(text, from, to);

      makeIndentationMark(from, to, indent, tabSize, builder);
    }
  }
  return builder.finish();
}

const showIndentations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = makeIndentationDecorators(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = makeIndentationDecorators(update.view);
    }
  },
  {
    decorations: v => v.decorations,
  }
);

const indentationTheme = EditorView.baseTheme({
  ".cm-indentation-widget": {
    display: "inline-block",
  },
  ".cm-indentation-guide": {
    position: "relative",
  },
  ".cm-indentation-guide:after": {
    position: "absolute",
    content: "''",
    right: "0.5ch",
    height: "1.3em",
    borderLeft: "1px solid rgba(193, 199, 249, 0.4)",
  },
  ..._.fromPairs(
    indentationLevelMarks.map((_decoration, i) => [
      `.cm-indentation-level-${i}`,
      { textIndent: `-${i * 2}ch`, marginLeft: `${i * 2}ch` },
    ])
  ),
});
