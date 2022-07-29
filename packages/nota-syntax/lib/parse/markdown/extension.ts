import { tags as t } from "@lezer/highlight";

import {
  BlockContext,
  Element,
  InlineContext,
  LeafBlock,
  LeafBlockParser,
  Line,
  MarkdownConfig,
  space,
} from "./markdown.js";

const StrikethroughDelim = { resolve: "Strikethrough", mark: "StrikethroughMark" };

/// An extension that implements
/// [GFM-style](https://github.github.com/gfm/#strikethrough-extension-)
/// Strikethrough syntax using `~~` delimiters.
export const Strikethrough: MarkdownConfig = {
  defineNodes: [
    {
      name: "Strikethrough",
      style: { "Strikethrough/...": t.strikethrough },
    },
    {
      name: "StrikethroughMark",
      style: t.processingInstruction,
    },
  ],
  parseInline: [
    {
      name: "Strikethrough",
      parse(cx, next, pos) {
        if (next != 126 /* '~' */ || cx.char(pos + 1) != 126) return -1;
        return cx.addDelimiter(StrikethroughDelim, pos, pos + 2, true, true);
      },
      after: "Emphasis",
    },
  ],
};

function parseRow(cx: BlockContext, line: string, startI = 0, elts?: Element[], offset = 0) {
  let count = 0,
    first = true,
    cellStart = -1,
    cellEnd = -1,
    esc = false;
  let parseCell = () => {
    elts!.push(
      cx.elt(
        "TableCell",
        offset + cellStart,
        offset + cellEnd,
        cx.parser.parseInline(line.slice(cellStart, cellEnd), offset + cellStart)
      )
    );
  };

  for (let i = startI; i < line.length; i++) {
    let next = line.charCodeAt(i);
    if (next == 124 /* '|' */ && !esc) {
      if (!first || cellStart > -1) count++;
      first = false;
      if (elts) {
        if (cellStart > -1) parseCell();
        elts.push(cx.elt("TableDelimiter", i + offset, i + offset + 1));
      }
      cellStart = cellEnd = -1;
    } else if (esc || (next != 32 && next != 9)) {
      if (cellStart < 0) cellStart = i;
      cellEnd = i + 1;
    }
    esc = !esc && next == 92;
  }
  if (cellStart > -1) {
    count++;
    if (elts) parseCell();
  }
  return count;
}

function hasPipe(str: string, start: number) {
  for (let i = start; i < str.length; i++) {
    let next = str.charCodeAt(i);
    if (next == 124 /* '|' */) return true;
    if (next == 92 /* '\\' */) i++;
  }
  return false;
}

const delimiterLine = /^\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?\s*)?$/;

class TableParser implements LeafBlockParser {
  // Null means we haven't seen the second line yet, false means this
  // isn't a table, and an array means this is a table and we've
  // parsed the given rows so far.
  rows: false | null | Element[] = null;

  nextLine(cx: BlockContext, line: Line, leaf: LeafBlock) {
    if (this.rows == null) {
      // Second line
      this.rows = false;
      let lineText;
      if (
        (line.next == 45 || line.next == 58 || line.next == 124) /* '-:|' */ &&
        delimiterLine.test((lineText = line.text.slice(line.pos)))
      ) {
        let firstRow: Element[] = [],
          firstCount = parseRow(cx, leaf.content, 0, firstRow, leaf.start);
        if (firstCount == parseRow(cx, lineText, line.pos))
          this.rows = [
            cx.elt("TableHeader", leaf.start, leaf.start + leaf.content.length, firstRow),
            cx.elt("TableDelimiter", cx.lineStart + line.pos, cx.lineStart + line.text.length),
          ];
      }
    } else if (this.rows) {
      // Line after the second
      let content: Element[] = [];
      parseRow(cx, line.text, line.pos, content, cx.lineStart);
      this.rows.push(
        cx.elt("TableRow", cx.lineStart + line.pos, cx.lineStart + line.text.length, content)
      );
    }
    return false;
  }

  finish(cx: BlockContext, leaf: LeafBlock) {
    if (!this.rows) return false;
    cx.addLeafElement(
      leaf,
      cx.elt("Table", leaf.start, leaf.start + leaf.content.length, this.rows as readonly Element[])
    );
    return true;
  }
}

/// This extension provides
/// [GFM-style](https://github.github.com/gfm/#tables-extension-)
/// tables, using syntax like this:
///
/// ```
/// | head 1 | head 2 |
/// | ---    | ---    |
/// | cell 1 | cell 2 |
/// ```
export const Table: MarkdownConfig = {
  defineNodes: [
    { name: "Table", block: true },
    { name: "TableHeader", style: { "TableHeader/...": t.heading } },
    "TableRow",
    { name: "TableCell", style: t.content },
    { name: "TableDelimiter", style: t.processingInstruction },
  ],
  parseBlock: [
    {
      name: "Table",
      leaf(_, leaf) {
        return hasPipe(leaf.content, 0) ? new TableParser() : null;
      },
      endLeaf(cx, line, leaf) {
        if (leaf.parsers.some(p => p instanceof TableParser) || !hasPipe(line.text, line.basePos))
          return false;
        let next = cx.scanLine(cx.absoluteLineEnd + 1).text;
        return (
          delimiterLine.test(next) &&
          parseRow(cx, line.text, line.basePos) == parseRow(cx, next, line.basePos)
        );
      },
      before: "SetextHeading",
    },
  ],
};

class TaskParser implements LeafBlockParser {
  nextLine() {
    return false;
  }

  finish(cx: BlockContext, leaf: LeafBlock) {
    cx.addLeafElement(
      leaf,
      cx.elt("Task", leaf.start, leaf.start + leaf.content.length, [
        cx.elt("TaskMarker", leaf.start, leaf.start + 3),
        ...cx.parser.parseInline(leaf.content.slice(3), leaf.start + 3),
      ])
    );
    return true;
  }
}

/// Extension providing
/// [GFM-style](https://github.github.com/gfm/#task-list-items-extension-)
/// task list items, where list items can be prefixed with `[ ]` or
/// `[x]` to add a checkbox.
export const TaskList: MarkdownConfig = {
  defineNodes: [
    { name: "Task", block: true, style: t.list },
    { name: "TaskMarker", style: t.atom },
  ],
  parseBlock: [
    {
      name: "TaskList",
      leaf(cx, leaf) {
        return /^\[[ xX]\]/.test(leaf.content) && cx.parentType().name == "ListItem"
          ? new TaskParser()
          : null;
      },
      after: "SetextHeading",
    },
  ],
};

/// Extension bundle containing [`Table`](#Table),
/// [`TaskList`](#TaskList) and [`Strikethrough`](#Strikethrough).
export const GFM = [Table, TaskList, Strikethrough];

function parseSubSuper(ch: number, node: string, mark: string) {
  return (cx: InlineContext, next: number, pos: number) => {
    if (next != ch || cx.char(pos + 1) == ch) return -1;
    let elts = [cx.elt(mark, pos, pos + 1)];
    for (let i = pos + 1; i < cx.end; i++) {
      let next = cx.char(i);
      if (next == ch)
        return cx.addElement(cx.elt(node, pos, i + 1, elts.concat(cx.elt(mark, i, i + 1))));
      if (next == 92 /* '\\' */) elts.push(cx.elt("Escape", i, i++ + 2));
      if (space(next)) break;
    }
    return -1;
  };
}

/// Extension providing
/// [Pandoc-style](https://pandoc.org/MANUAL.html#superscripts-and-subscripts)
/// superscript using `^` markers.
export const Superscript: MarkdownConfig = {
  defineNodes: [
    { name: "Superscript", style: t.special(t.content) },
    { name: "SuperscriptMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "Superscript",
      parse: parseSubSuper(94 /* '^' */, "Superscript", "SuperscriptMark"),
    },
  ],
};

/// Extension providing
/// [Pandoc-style](https://pandoc.org/MANUAL.html#superscripts-and-subscripts)
/// subscript using `~` markers.
export const Subscript: MarkdownConfig = {
  defineNodes: [
    { name: "Subscript", style: t.special(t.content) },
    { name: "SubscriptMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "Subscript",
      parse: parseSubSuper(126 /* '~' */, "Subscript", "SubscriptMark"),
    },
  ],
};

/// Extension that parses two colons with only letters, underscores,
/// and numbers between them as `Emoji` nodes.
export const Emoji: MarkdownConfig = {
  defineNodes: [{ name: "Emoji", style: t.character }],
  parseInline: [
    {
      name: "Emoji",
      parse(cx, next, pos) {
        let match: RegExpMatchArray | null;
        if (next != 58 /* ':' */ || !(match = /^[a-zA-Z_0-9]+:/.exec(cx.slice(pos + 1, cx.end))))
          return -1;
        return cx.addElement(cx.elt("Emoji", pos, pos + 1 + match[0].length));
      },
    },
  ],
};
