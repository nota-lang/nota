import { InlineContext, MarkdownConfig } from "@lezer/markdown";

let special = ["---"];
let maxLen = special.map(s => s.length).reduce((n1, n2) => Math.max(n1, n2));

let parseSpecial = (cx: InlineContext, next: number, pos: number): number => {
  let substr = cx.slice(pos, pos + maxLen);
  for (let s of special) {
    if (substr.startsWith(s)) {
      return cx.addElement(cx.elt("Special", pos, pos + s.length));
    }
  }

  return -1;
};

export let SpecialExtension: MarkdownConfig = {
  defineNodes: [{ name: "Special" }],
  parseInline: [{ name: "Special", parse: parseSpecial }],
};
