import { Tag } from "@lezer/highlight";
import { BlockContext, DelimiterType, InlineContext, Line, MarkdownConfig } from "@lezer/markdown";
import _ from "lodash";

import { BlockResult, notaTemplateBlock } from "./nota.js";

let dollar = "$".charCodeAt(0);

export let MathDelimiter: DelimiterType = {
  resolve: "MathInline",
  mark: "MathMark",
};

let parseMathInline = (cx: InlineContext, next: number, pos: number): number => {
  if (next == dollar) {
    cx.addDelimiter(MathDelimiter, pos, pos + 1, true, true);
  }

  return -1;
};

let parseMathBlock = (cx: BlockContext, line: Line): BlockResult => {
  if (line.text.startsWith("$$")) {
    let start = cx.lineStart;
    let startDelim = cx.elt("MathMark", cx.lineStart, cx.lineStart + 2);
    cx.nextLine();
    let contents = notaTemplateBlock(cx, line, (_cx, line) => line.text.startsWith("$$"));
    let endDelim = cx.elt("MathMark", cx.lineStart, cx.lineStart + 2);
    cx.addElement(cx.elt("MathBlock", start, endDelim.to, [startDelim, contents, endDelim]));
    cx.nextLine();
    return true;
  }

  return false;
};

export let MathTag = Tag.define();

export let MathExtension: MarkdownConfig = {
  defineNodes: [
    {
      name: "MathInline",
      style: {
        "MathInline/...": MathTag,
      },
    },
    {
      name: "MathMark",
      style: MathTag,
    },
    {
      name: "MathBlock",
      block: true,
    },
    { name: "MathContents", style: { "MathContents/...": MathTag } },
  ],
  parseBlock: [
    {
      name: "MathBlock",
      parse: parseMathBlock,
    },
  ],
  parseInline: [
    {
      name: "MathInline",
      parse: parseMathInline,
    },
  ],
};
