import { tags as t } from "@lezer/highlight";

import { InlineContext, MarkdownConfig } from "../markdown/index.js";
import { notaCommandName } from "./nota.js";

let amp = "&".charCodeAt(0);

let parseRef = (cx: InlineContext, next: number, pos: number): number => {
  if (next == amp && cx.end > pos + 1 && !cx.slice(pos + 1, pos + 2).match(/\s/)) {
    let start = pos;
    let ampEl = cx.elt("&", pos, pos + 1);
    pos += 1;
    let nameEl = notaCommandName(cx, pos);
    if (!nameEl) return -1;
    pos = nameEl.to;

    return cx.addElement(cx.elt("Ref", start, pos, [ampEl, nameEl]));
  }

  return -1;
};

export let RefExtension: MarkdownConfig = {
  defineNodes: [
    {
      name: "Ref",
      style: {
        // TODO: this isn't matching correctly
        "Ref/NotaCommandName/NotaCommandNameText": t.string,
      },
    },
    { name: "&", style: t.modifier },
  ],
  parseInline: [
    {
      name: "Ref",
      parse: parseRef,
    },
  ],
};
