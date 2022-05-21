import { NodeType, parseMixed } from "@lezer/common";
import { tags as t } from "@lezer/highlight";
import { LRParser } from "@lezer/lr";
import {
  BlockContext,
  DelimiterType,
  Element,
  InlineContext,
  Line,
  MarkdownConfig,
  MarkdownParser,
} from "@lezer/markdown";
import _ from "lodash";

//@ts-ignore
import { parser as baseJsParser } from "../notajs.grammar.js";
//@ts-ignore
import * as jsTerms from "../notajs.grammar.terms.js";

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

export type BlockResult = boolean | null;

let notaScriptParser = (cx: BlockContext, line: Line): BlockResult => {
  if (line.next == pct) {
    let start = cx.lineStart;
    if (line.text.length >= 3 && line.text.slice(0, 3) == "%%%") {
      let openDelim = cx.elt("%%%", start, start + 3);
      let marks: Element[] = [];
      while (cx.nextLine()) {
        if (line.text == "%%%") {
          break;
        }
        marks.push(cx.elt("NotaJs", cx.lineStart, cx.lineStart + line.text.length));
      }
      let closeDelim = cx.elt("%%%", cx.lineStart, cx.lineStart + 3);
      cx.nextLine();
      cx.addElement(
        cx.elt("NotaScript", start + 3, cx.prevLineEnd() - 3, [
          openDelim,
          cx.elt("NotaScriptBody", marks[0].from, _.last(marks)!.to, marks),
          closeDelim,
        ])
      );
    } else {
      cx.addElement(
        cx.elt("NotaScript", cx.lineStart + 1, cx.lineStart + line.text.length, [
          cx.elt("%", cx.lineStart, cx.lineStart + 1),
          cx.elt("NotaScriptBody", cx.lineStart + 1, cx.lineStart + line.text.length, [
            cx.elt("NotaJs", cx.lineStart + 1, cx.lineStart + line.text.length),
          ]),
        ])
      );
      cx.nextLine();
    }
    return true;
  }

  return false;
};

let notaBlockAttributeParser = (cx: BlockContext, line: Line): BlockResult => {
  if (line.next == pipe) {
    let pos = cx.lineStart + line.pos;
    let icx = new (InlineContext as any)(
      cx.parser,
      line.text.slice(line.pos),
      pos
    ) as InlineContext;
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

    let children: Element[] = [cx.elt("NotaAttributeKey", identStart, identStart + identLength)];

    if (pos == icx.end) {
      let indent = line.baseIndent + 2;

      let marks: Element[] = [];
      while (cx.nextLine()) {
        if (line.next == -1) {
          // Empty
        } else if (line.indent < indent) {
          break;
        } else {
          marks.push(cx.elt("NotaJs", cx.lineStart + indent, cx.lineStart + line.text.length));
        }
      }

      children.push(cx.elt("NotaAttributeValue", marks[0].from, _.last(marks)!.to, marks));
    } else {
      if (icx.char(pos) != space) return false;
      pos += 1;

      children.push(cx.elt("NotaAttributeValue", pos, icx.end));

      cx.nextLine();
    }

    cx.addElement(cx.elt("NotaBlockAttribute", start, cx.prevLineEnd(), children));

    return true;
  }

  return false;
};

// @Component[(key: value),*]: inline?
//   | key: value
//   sub-block
let notaBlockComponentParser = (cx: BlockContext, line: Line): BlockResult => {
  let next = line.next;
  if (next == atSign) {
    let pos = cx.lineStart + line.pos;
    let start = pos;
    let icx = new (InlineContext as any)(
      cx.parser,
      line.text.slice(line.pos),
      pos
    ) as InlineContext;
    let startRelative = line.pos;

    // @
    let children = [cx.elt("@", pos, pos + 1)];
    pos += 1;

    // Component
    let nameEl = notaCommandName(icx, pos);
    if (!nameEl) return false;
    pos = nameEl.to;
    children.push(nameEl);

    // [(key: value),*]
    let attrStart = pos;
    let attrEnd = munchBalancedSubstring(icx, attrStart, lbrkt, rbrkt);
    if (attrEnd != -1) {
      pos = attrEnd;
      children.push(cx.elt("NotaInlineAttributes", attrStart, attrEnd));
    }

    // EOL?
    if (pos == icx.end) {
      cx.addElement(cx.elt("NotaBlockComponent", start, pos, children));
      cx.nextLine();
      return true;
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
    cx.startComposite("NotaBlockComponent", startRelative, INDENT);
    children.forEach(child => cx.addElement(child));

    // If the next line is blank or not at the right level of indentation,
    // then immediately finish the composite block.
    cx.nextLine();
    if (!skipForNota(cx, line, INDENT) || line.next == -1) {
      return true;
    } else {
      return null;
    }
  }

  return false;
};

let skipForNota = (_cx: BlockContext, line: Line, value: number): boolean => {
  if (line.indent < line.baseIndent + value && line.next > -1) return false;

  line.moveBaseColumn(line.baseIndent + value);
  return true;
};

let notaCommandName = (cx: InlineContext, pos: number): Element | null => {
  if (cx.slice(pos, pos + 1).match(/\d/)) {
    return cx.elt("NotaCommandName", pos, pos + 1, [cx.elt("NotaCommandNameAnon", pos, pos + 1)]);
  }

  let balancedEnd = munchBalancedSubstring(cx, pos, lparen, rparen);
  if (balancedEnd > -1) {
    return cx.elt("NotaCommandName", pos, balancedEnd, [
      cx.elt("NotaJs", pos + 1, balancedEnd - 1),
    ]);
  } else {
    let identLength = munchIdent(cx.slice(pos, cx.end));
    if (identLength == -1) return null;
    return cx.elt("NotaCommandName", pos, pos + identLength, [
      cx.elt("NotaCommandNameText", pos, pos + identLength),
    ]);
  }
};

const NotaComponentDelimiter: DelimiterType = {};
const NotaInterpolationDelimiter: DelimiterType = {};
const NotaInlineContentDelimiter: DelimiterType = {
  resolve: "NotaInlineContent",
  mark: "NotaInlineContentMark",
};

let notaInterpolationStart = (cx: InlineContext, next: number, pos: number): number => {
  if (next == hash) {
    let start = pos;

    let children = [cx.elt("#", pos, pos + 1)];
    pos += 1;

    let nameEl = notaCommandName(cx, pos);
    if (!nameEl) return -1;
    pos = nameEl.to;
    children.push(nameEl);

    if (pos < cx.end && cx.char(pos) == lbrc) {
      cx.addDelimiter(NotaInterpolationDelimiter, start, pos, true, false);
      children.forEach(el => cx.addElement(el));
      return cx.addDelimiter(NotaInlineContentDelimiter, pos, pos + 1, true, false);
    } else {
      return cx.addElement(cx.elt("NotaInterpolation", start, pos, children));
    }
  }

  return -1;
};

let notaInlineContentToLineEnd = (cx: InlineContext, pos: number): Element => {
  let end;
  if (cx.findOpeningDelimiter(NotaComponentDelimiter) !== null) {
    for (end = pos; end < cx.end; end++) {
      if (cx.char(end) == rbrc) break;
    }
  } else {
    end = cx.end;
  }
  let children = cx.parser.parseInline(cx.slice(pos, end), pos);
  return cx.elt("NotaInlineContent", pos, end, children);
};

let notaInlineComponentStart = (cx: InlineContext, next: number, pos: number): number => {
  if (next == atSign) {
    let start = pos;

    // @
    let children = [cx.elt("@", pos, pos + 1)];
    pos += 1;

    // Component
    let nameEl = notaCommandName(cx, pos);
    if (!nameEl) return -1;
    pos = nameEl.to;
    children.push(nameEl);

    let fallback = () => cx.addElement(cx.elt("NotaInlineComponent", start, pos, children));

    if (pos == cx.end) return fallback();

    // [key: value, ...]
    let attrStart = pos;
    let attrEnd = munchBalancedSubstring(cx, attrStart, lbrkt, rbrkt);
    if (attrEnd != -1) {
      pos = attrEnd;
      children.push(cx.elt("NotaInlineAttributes", attrStart, attrEnd));
    }

    if (pos == cx.end) return fallback();

    next = cx.char(pos);
    pos += 1;
    if (next == colon && pos < cx.end && cx.char(pos) == space) {
      let inlineContent = notaInlineContentToLineEnd(cx, pos + 1);
      pos = inlineContent.to;
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

// TODO: rewrite this using stable APIs, i.e. findOpeningDelimiter
export let notaInlineEnd = (cx: InlineContext, next: number, pos: number): number => {
  if (
    next == rbrc &&
    (cx.findOpeningDelimiter(NotaComponentDelimiter) != null ||
      cx.findOpeningDelimiter(NotaInterpolationDelimiter) != null)
  ) {
    cx.addDelimiter(NotaInlineContentDelimiter, pos, pos + 1, false, true);
    if (pos < cx.end && cx.char(pos + 1) == lbrc) {
      cx.addDelimiter(NotaInlineContentDelimiter, pos + 1, pos + 2, true, false);
      return pos + 2;
    } else {
      let parts = (cx as any).parts as Element[];
      for (let i = parts.length - 1; i >= 0; i--) {
        let part = parts[i];
        if (
          "type" in part &&
          // part instanceof InlineDelimiter &&
          (part.type == NotaComponentDelimiter || part.type == NotaInterpolationDelimiter)
        ) {
          let children = cx.takeContent(i);
          let component = cx.elt(
            part.type == NotaComponentDelimiter ? "NotaInlineComponent" : "NotaInterpolation",
            part.from,
            pos + 1,
            children
          );
          parts[i] = component;

          return component.to;
        }
      }
    }
  }

  return -1;
};

export let notaVerbatimBlock = (
  cx: BlockContext,
  line: Line,
  parseEnd: (cx: BlockContext, line: Line) => BlockResult
): Element[] => {
  let elements: Element[] = [];
  while (parseEnd(cx, line) == false) {
    let icx = new (InlineContext as any)(cx.parser, line.text, cx.lineStart) as InlineContext;
    for (let pos = icx.offset; pos < icx.end; pos++) {
      if (notaInterpolationStart(icx, icx.char(pos), pos) > -1) continue;
      else notaInlineEnd(icx, icx.char(pos), pos);
    }
    elements = elements.concat(icx.takeContent(0));
    cx.nextLine();
  }
  return elements;
};

export type Terms = { [key: string]: number };
export let configureParserForNota = (
  mdParser: MarkdownParser
): {
  mdParser: MarkdownParser;
  mdTerms: Terms;
  jsParser: LRParser;
} => {
  let parserRef = mdParser;
  let mdTerms: { [key: string]: number };

  let notaWrap = parseMixed((node, _input) => {
    if (node.type.id == jsTerms.NotaCommand || node.type.id == jsTerms.NotaMacroBody) {
      return { parser: parserRef };
    } else {
      return null;
    }
  });

  let jsParser: LRParser = baseJsParser.configure({ wrap: notaWrap });
  let exprParser = jsParser.configure({ top: "NotaExpr" });
  let attrParser = jsParser.configure({ top: "NotaInlineAttrs" });
  let stmtParser = jsParser.configure({ top: "NotaStmts" });

  let mdWrap = parseMixed((node, _input) => {
    if (node.type.id == mdTerms.NotaAttributeValue) {
      // TODO: when *any* overlay is added, the nested parse doesn't seem to work?
      return { parser: exprParser /*overlay: node => node.type.id == Type.NotaJs*/ };
    } else if (node.type.id == mdTerms.NotaScriptBody) {
      return { parser: stmtParser };
    } else if (node.type.id == mdTerms.NotaInlineAttributes) {
      return { parser: attrParser };
    } else {
      return null;
    }
  });

  let extension: MarkdownConfig = {
    defineNodes: [
      {
        name: "NotaBlockComponent",
        block: true,
        composite: skipForNota,
      },
      { name: "NotaInlineComponent" },
      { name: "NotaInterpolation" },
      { name: "NotaCommandName" },
      { name: "NotaCommandNameText", style: t.special(t.variableName) },
      { name: "NotaCommandNameAnon", style: t.number },
      { name: "NotaInlineAttributes" },
      {
        name: "NotaBlockAttribute",
        block: true,
      },
      { name: "NotaAttributeKey" },
      { name: "NotaAttributeValue" },
      { name: "NotaScript" },
      { name: "NotaScriptBody" },
      { name: "NotaJs" },
      { name: "NotaInlineContent" },
      { name: "NotaInlineComponentMark" },
      { name: "NotaInlineContentMark", style: t.brace },
      { name: "@", style: t.modifier },
      { name: "#", style: t.modifier },
      { name: "%", style: t.modifier },
      { name: "%%%", style: t.modifier },
    ],
    parseBlock: [
      {
        name: "NotaScript",
        parse: notaScriptParser,
      },
      {
        name: "NotaBlockAttribute",
        parse: notaBlockAttributeParser,
      },
      {
        name: "NotaBlockComponent",
        parse: notaBlockComponentParser,
      },
    ],
    parseInline: [
      {
        name: "NotaInlineComponentStart",
        parse: notaInlineComponentStart,
      },
      {
        name: "NotaInterpolationStart",
        parse: notaInterpolationStart,
      },
      {
        name: "NotaInlineEnd",
        parse: notaInlineEnd,
      },
    ],
    wrap: mdWrap,
  };

  parserRef = mdParser.configure([extension]);
  mdTerms = _.fromPairs(
    parserRef.nodeSet.types
      .filter(node => node instanceof NodeType)
      .map(node => [node.name, node.id])
  );

  return { mdParser: parserRef, mdTerms, jsParser };
};
