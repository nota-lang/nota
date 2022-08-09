import { Tag } from "@lezer/highlight";
import _ from "lodash";

import { BlockContext, InlineContext, Line, MarkdownConfig } from "../markdown/index.js";
import { BlockResult, notaTemplateBlock, notaTemplateInline } from "./nota.js";

let dollar = "$".charCodeAt(0);

let parseMathInline = (cx: InlineContext, next: number, pos: number): number => {
  if (next == dollar) {
    let elt = notaTemplateInline(cx, pos + 1, dollar);
    return cx.addElement(
      cx.elt("MathInline", pos, elt.to + 1, [
        cx.elt("MathMark", pos, pos + 1),
        elt,
        cx.elt("MathMark", elt.to, elt.to + 1),
      ])
    );
  }

  return -1;
};

let parseMathBlock = (cx: BlockContext, line: Line): BlockResult => {
  if (line.text.slice(line.pos).startsWith("$$")) {
    let pos = cx.lineStart + line.pos;
    let start = pos;
    let startDelim = cx.elt("MathMark", pos, pos + 2);
    pos += 2;

    let contents = notaTemplateBlock(cx, line, pos, text => text.indexOf("$$"));
    if (!contents || contents.to + 2 < cx.lineStart + line.text.length) return false;
    let endDelim = cx.elt("MathMark", contents.to, contents.to + 2);
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
      style: {
        "MathBlock/...": MathTag,
      },
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
