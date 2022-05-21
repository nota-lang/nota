import { Tag } from "@lezer/highlight";
import { BlockContext, DelimiterType, InlineContext, Line, MarkdownConfig } from "@lezer/markdown";

import { BlockResult, notaVerbatimBlock } from "./nota.js";

let dollar = "$".charCodeAt(0);

let mathDelimiter: DelimiterType = {
  resolve: "MathInline",
  mark: "MathInlineMark",
};

let parseMathInline = (cx: InlineContext, next: number, pos: number): number => {
  if (next == dollar) {
    cx.addDelimiter(mathDelimiter, pos, pos + 1, true, true);
  }

  return -1;
};

let parseMathBlock = (cx: BlockContext, line: Line): BlockResult => {
  if (line.text.startsWith("$$")) {
    cx.nextLine();
    let start = cx.lineStart;
    let elements = notaVerbatimBlock(cx, line, (_cx, line) => line.text.startsWith("$$"));
    cx.addElement(cx.elt("MathBlock", start, cx.prevLineEnd(), elements));
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
        // "MathInline/NotaInterpolation/...": MathTag,
      },
    },
    {
      name: "MathInlineMark",
      style: MathTag,
    },
    {
      name: "MathBlock",
      block: true,
      style: MathTag,
    },
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
