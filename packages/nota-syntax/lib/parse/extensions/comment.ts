import { BlockContext, InlineContext, Line, MarkdownConfig } from "../markdown/index.js";
import { BlockResult } from "./nota";

let [newline] = ["\n"].map(s => s.charCodeAt(0));

let parseCommentBlock = (cx: BlockContext, line: Line): BlockResult => {
  if (!line.text.slice(line.pos).startsWith("//")) return false;

  let start = cx.lineStart + line.pos;

  while (line.text.slice(line.pos).startsWith("//")) {
    if (!cx.nextLine()) break;
  }

  cx.addElement(cx.elt("Comment", start, cx.prevLineEnd()));

  return true;
};

let parseCommentInline = (cx: InlineContext, next: number, pos: number): number => {
  if (cx.slice(pos, pos + 2) == "//") {
    let start = pos;
    while (pos < cx.end && cx.char(pos) != newline) pos++;
    cx.addElement(cx.elt("Comment", start, pos));
    return pos;
  }

  return -1;
};

export let CommentExtension: MarkdownConfig = {
  defineNodes: [
    {
      name: "Comment",
    },
  ],
  parseBlock: [
    {
      name: "CommentBlock",
      parse: parseCommentBlock,
    },
  ],
  parseInline: [
    {
      name: "CommentInline",
      parse: parseCommentInline,
    },
  ],
};
