import { parseMixed } from "@lezer/common";
import { LRParser } from "@lezer/lr";
import _ from "lodash";

import {
  BlockContext,
  BlockResult,
  CompositeBlock,
  DelimiterType,
  Element,
  elt,
  InlineContext,
  InlineDelimiter,
  Line,
  MarkdownConfig,
  parser as mdParser,
  TreeElement,
  Type,
} from "./markdown.js";

//@ts-ignore
import { parser as baseNotaParser } from "./nota.grammar.js";
//@ts-ignore
import * as terms from "./nota.grammar.terms.js";

let [atSign, hash, pct, lbrc, rbrc, lparen, rparen, lbrkt, rbrkt, colon, pipe, space] = [
  "@",
  "#",
  "%",
  "{",
  "}",
  "(",
  ")",
  "[",
  "]",
  ":",
  "|",
  " ",
].map(s => s.charCodeAt(0));

let munchIdent = (text: string): number => {
  // TODO: handle unicode
  let match = text.match(/^[_\w][_\w\d]*/);
  if (!match) {
    return -1;
  }
  return match[0].length;
};

let munchBalancedSubstring = (
  cx: InlineContext,
  pos: number,
  left: number,
  right: number
): number => {
  if (cx.char(pos) == left) {
    let balance = 0;
    let end = -1;
    for (pos = pos + 1; pos < cx.end; ++pos) {
      let cur = cx.char(pos);
      if (cur == left) {
        ++balance;
      } else if (cur == right) {
        if (balance == 0) {
          end = pos + 1;
          break;
        }
        balance--;
      }
    }
    return end;
  }

  return -1;
};

export let notaScriptParser = (cx: BlockContext, line: Line): BlockResult => {
  if (line.next == pct) {
    let start = cx.lineStart;
    if (line.text.length >= 3 && line.text.slice(0, 3) == "%%%") {
      let marks: Element[] = [];
      while (cx.nextLine()) {
        if (line.text == "%%%") break;
        marks.push(elt(Type.NotaJs, cx.lineStart, cx.lineStart + line.text.length));
      }
      cx.nextLine();
      cx.addElement(elt(Type.NotaScript, start + 3, cx.prevLineEnd() - 3, marks));
    } else {
      cx.addElement(
        elt(Type.NotaScript, cx.lineStart + 1, cx.lineStart + line.text.length, [
          elt(Type.NotaJs, cx.lineStart + 1, cx.lineStart + line.text.length),
        ])
      );
      cx.nextLine();
    }
    return true;
  }

  return false;
};

export let notaBlockAttributeParser = (cx: BlockContext, line: Line): BlockResult => {
  if (line.next == pipe) {
    let pos = cx.lineStart + line.pos;
    let icx = new InlineContext(cx.parser, line.text.slice(line.pos), pos);
    let start = pos;

    // |
    pos += 1;

    // " "
    if (icx.char(pos) != space) return false;
    pos += 1;

    // id
    let identStart = pos;
    let identLength = munchIdent(icx.slice(identStart, icx.end));
    if (identLength == -1) return false;
    pos += identLength;

    // :
    if (icx.char(pos) != colon) return false;
    pos += 1;

    let children: (Element | TreeElement)[] = [
      elt(Type.NotaAttributeKey, identStart, identStart + identLength),
    ];

    if (pos == icx.end) {
      let indent = line.baseIndent + 2;

      let marks: Element[] = [];
      while (cx.nextLine() && line.depth >= cx.stack.length) {
        if (line.next == -1) {
          // Empty
        } else if (line.indent < indent) {
          break;
        } else {
          marks.push(elt(Type.NotaJs, cx.lineStart + indent, cx.lineStart + line.text.length));
        }
      }

      children.push(elt(Type.NotaAttributeValue, marks[0].from, _.last(marks)!.to, marks));
    } else {
      if (icx.char(pos) != space) return false;
      pos += 1;

      children.push(elt(Type.NotaAttributeValue, pos, icx.end));

      cx.nextLine();
    }

    cx.addElement(elt(Type.NotaBlockAttribute, start, cx.prevLineEnd(), children));

    return true;
  }

  return false;
};

// @Component{(key: value),*}: inline?
//   | key: value
//   sub-block
export let notaComponentBlockParser = (cx: BlockContext, line: Line): BlockResult => {
  let next = line.next;
  if (next == atSign) {
    let pos = cx.lineStart + line.pos;
    let icx = new InlineContext(cx.parser, line.text.slice(line.pos), pos);
    let start = pos;
    let startRelative = line.pos;

    // @
    pos += 1;

    // Component
    let nameEl = notaCommandName(icx, pos);
    if (!nameEl) return false;
    pos = nameEl.to;

    let children = [nameEl];

    // {(key: value),*}
    let attrStart = pos;
    let attrEnd = munchBalancedSubstring(icx, attrStart, lbrkt, rbrkt);
    if (attrEnd != -1) {
      pos = attrEnd;
      children.push(elt(Type.NotaInlineAttributes, attrStart, attrEnd));
    }

    // :
    if (icx.char(pos) != colon) return false;
    pos += 1;

    // inline?
    if (pos < icx.end) {
      // " "
      if (icx.char(pos) != space) return false;
      pos += 1;

      children.push(notaInlineContentToLineEnd(icx, pos));
    }

    let INDENT = 2;
    cx.startContext(Type.NotaComponent, startRelative, INDENT);
    children.forEach(child => cx.addElement(child));
    cx.nextLine();
    if (line.next == -1) {
      return true;
    } else {
      return null;
    }
  }

  return false;
};

export let skipForNota = (bl: CompositeBlock, _cx: BlockContext, line: Line): boolean => {
  if (line.indent < line.baseIndent + bl.value && line.next > -1) return false;

  line.moveBaseColumn(line.baseIndent + bl.value);
  return true;
};

let notaCommandName = (cx: InlineContext, pos: number): Element | null => {
  let balancedEnd = munchBalancedSubstring(cx, pos, lparen, rparen);
  if (balancedEnd > -1) {
    return elt(Type.NotaCommandName, pos, balancedEnd, [
      elt(Type.NotaJs, pos + 1, balancedEnd - 1),
    ]);
  } else {
    let identLength = munchIdent(cx.slice(pos, cx.end));
    if (identLength == -1) return null;
    return elt(Type.NotaCommandName, pos, pos + identLength);
  }
};

const NotaComponentDelimiter: DelimiterType = {};
const NotaInterpolationDelimiter: DelimiterType = {};
const NotaInlineContentDelimiter: DelimiterType = {
  resolve: "NotaInlineContent",
  mark: "NotaInlineContentMark",
};

export let notaInterpolationInlineStart = (
  cx: InlineContext,
  next: number,
  pos: number
): number => {
  if (next == hash) {
    let start = pos;
    pos += 1;

    let nameEl = notaCommandName(cx, pos);
    if (!nameEl) return -1;
    pos = nameEl.to;

    if (pos < cx.end && cx.char(pos) == lbrc) {
      cx.addDelimiter(NotaInterpolationDelimiter, start, pos, true, false);
      cx.addElement(nameEl);
      return cx.addDelimiter(NotaInlineContentDelimiter, pos, pos + 1, true, false);
    } else {
      return cx.addElement(elt(Type.NotaInterpolation, start, pos, [nameEl]));
    }
  }

  return -1;
};

let notaInlineContentToLineEnd = (cx: InlineContext, pos: number): Element => {
  let children = cx.parser.parseInline(cx.slice(pos, cx.end), pos);
  return elt(Type.NotaInlineContent, pos, cx.end, children);
};

export let notaComponentInlineStart = (cx: InlineContext, next: number, pos: number): number => {
  if (next == atSign) {
    let start = pos;
    pos += 1;

    let nameEl = notaCommandName(cx, pos);
    if (!nameEl) return -1;
    pos = nameEl.to;

    let children = [nameEl];
    let fallback = () => cx.addElement(elt(Type.NotaComponent, start, cx.end, children));

    if (pos == cx.end) return fallback();

    let attrStart = pos;
    let attrEnd = munchBalancedSubstring(cx, attrStart, lbrkt, rbrkt);
    if (attrEnd != -1) {
      pos = attrEnd;
      children.push(elt(Type.NotaInlineAttributes, attrStart, attrEnd));
    }

    if (pos == cx.end) return fallback();

    next = cx.char(pos);
    pos += 1;
    if (next == colon && pos < cx.end && cx.char(pos) == space) {
      let inlineContent = notaInlineContentToLineEnd(cx, pos + 1);
      children.push(inlineContent);
      return fallback();
    } else if (next == lbrc) {
      cx.addDelimiter(NotaComponentDelimiter, start, pos - 1, true, false);
      children.forEach(child => cx.addElement(child));
      cx.addDelimiter(NotaInlineContentDelimiter, pos - 1, pos, true, false);
      return pos;
    } else {
      return fallback();
    }
  }
  return -1;
};

export let notaInlineEnd = (cx: InlineContext, next: number, pos: number): number => {
  if (next == rbrc) {
    cx.addDelimiter(NotaInlineContentDelimiter, pos, pos + 1, false, true);
    if (pos < cx.end && cx.char(pos + 1) == lbrc) {
      cx.addDelimiter(NotaInlineContentDelimiter, pos + 1, pos + 2, true, false);
      return pos + 2;
    } else {
      for (let i = cx.parts.length - 1; i >= 0; i--) {
        let part = cx.parts[i];
        if (
          part instanceof InlineDelimiter &&
          (part.type == NotaComponentDelimiter || part.type == NotaInterpolationDelimiter)
        ) {
          let children = cx.takeContent(i);
          let component = elt(
            part.type == NotaComponentDelimiter ? Type.NotaComponent : Type.NotaInterpolation,
            part.from,
            pos + 1,
            children
          );
          cx.parts[i] = component;

          return component.to;
        }
      }
    }
  }

  return -1;
};

let notaWrap = parseMixed((node, _input) => {
  if (node.type.id == terms.Markdown) {
    return { parser: mdParser };
  } else {
    return null;
  }
});

let notaParser: LRParser = baseNotaParser.configure({ wrap: notaWrap });
let notaExprParser = notaParser.configure({ top: "NotaExpr" });
let notaAttrParser = notaParser.configure({ top: "NotaInlineAttrs" });
let notaStmtParser = notaParser.configure({ top: "NotaStmts" });

export let mdWrap = parseMixed((node, _input) => {
  if (node.type.id == Type.NotaAttributeValue) {
    // TODO: when *any* overlay is added, the nested parse doesn't seem to work?
    return { parser: notaExprParser /*overlay: node => node.type.id == Type.NotaJs*/ };
  } else if (node.type.id == Type.NotaScript) {
    return { parser: notaStmtParser };
  } else if (node.type.id == Type.NotaInlineAttributes) {
    return { parser: notaAttrParser };
  } else {
    return null;
  }
});
