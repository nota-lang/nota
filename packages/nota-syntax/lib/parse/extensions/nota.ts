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

let BLOCK_COMPLETE = true;
let BLOCK_FAIL = false;
let BLOCK_CONTINUE: null = null;
let INLINE_FAIL = -1;
let END_OF_LINE = -1;
export type BlockResult = boolean | null;

let makeInlineContext = (cx: BlockContext, line: Line): InlineContext =>
  new (InlineContext as any)(cx.parser, line.text.slice(line.pos), cx.lineStart + line.pos);

let munchIdent = (text: string): number => {
  // TODO: handle unicode
  let match = text.match(/^[_\w][_\w\d]*/);
  if (!match) {
    return INLINE_FAIL;
  }
  return match[0].length;
};

let munchBalancedSubstringBlock = (
  cx: BlockContext,
  line: Line,
  pos: number,
  left: number,
  right: number
): number => {
  let icx = makeInlineContext(cx, line);
  if (icx.char(pos) == left) {
    let balance = 0;
    do {
      icx = makeInlineContext(cx, line);
      let [end, newBalance] = munchBalancedSubstring(icx, pos, left, right, balance);
      balance = newBalance;
      if (balance == -1) {
        return end;
      }
    } while (cx.nextLine());
  }

  return -1;
};

let munchBalancedSubstring = (
  cx: InlineContext,
  pos: number,
  left: number,
  right: number,
  initialBalance: number = -1
): [number, number] => {
  if (cx.char(pos) == left || initialBalance != -1) {
    let balance = initialBalance != -1 ? initialBalance : 0;
    for (pos = pos + 1; pos < cx.end; ++pos) {
      let cur = cx.char(pos);
      if (cur == left) {
        ++balance;
      } else if (cur == right) {
        if (balance == 0) {
          return [pos + 1, -1];
        }
        balance--;
      }
    }

    return [cx.end, balance];
  }

  return [-1, 0];
};

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
      let body =
        marks.length > 0
          ? cx.elt("NotaScriptBody", marks[0].from, _.last(marks)!.to, marks)
          : cx.elt("NotaScriptBody", cx.lineStart, cx.lineStart);
      cx.addElement(
        cx.elt("NotaScript", start + 3, cx.prevLineEnd() - 3, [openDelim, body, closeDelim])
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
    return BLOCK_COMPLETE;
  }

  return BLOCK_FAIL;
};

let notaBlockAttributeParser = (cx: BlockContext, line: Line): BlockResult => {
  if (line.next == pipe) {
    let icx = makeInlineContext(cx, line);
    let pos = icx.offset;
    let start = pos;

    // |
    pos += 1;

    // " "
    if (icx.char(pos) != space) return BLOCK_FAIL;
    pos += 1;

    // id
    let identStart = pos;
    let identLength = munchIdent(icx.slice(identStart, icx.end));
    if (identLength == INLINE_FAIL) return BLOCK_FAIL;
    pos += identLength;

    // :
    if (icx.char(pos) != colon) return BLOCK_FAIL;
    pos += 1;

    let children: Element[] = [cx.elt("NotaAttributeKey", identStart, identStart + identLength)];

    if (pos == icx.end) {
      let indent = line.baseIndent + 2;

      let marks: Element[] = [];
      while (cx.nextLine()) {
        if (line.next == END_OF_LINE) {
          // Empty
        } else if (line.indent < indent) {
          break;
        } else {
          marks.push(cx.elt("NotaJs", cx.lineStart + indent, cx.lineStart + line.text.length));
        }
      }

      if (marks.length > 0) {
        children.push(cx.elt("NotaAttributeValue", marks[0].from, _.last(marks)!.to, marks));
      }
    } else {
      if (icx.char(pos) != space) return BLOCK_FAIL;
      pos += 1;

      children.push(cx.elt("NotaAttributeValue", pos, icx.end));

      cx.nextLine();
    }

    cx.addElement(cx.elt("NotaBlockAttribute", start, cx.prevLineEnd(), children));

    return BLOCK_COMPLETE;
  }

  return BLOCK_FAIL;
};

// @Component[(key: value),*]: inline?
//   | key: value
//   sub-block
let notaBlockComponentParser = (cx: BlockContext, line: Line): BlockResult => {
  let next = line.next;
  if (next == atSign) {
    let icx = makeInlineContext(cx, line);
    let pos = icx.offset;
    let start = pos;
    let startRelative = line.pos;

    // @
    let children = [cx.elt("@", pos, pos + 1)];
    pos += 1;

    // Component
    let nameEl = notaCommandName(icx, pos);
    if (!nameEl) return BLOCK_FAIL;
    pos = nameEl.to;
    children.push(nameEl);

    // [(key: value),*]
    let attrStart = pos;
    let attrEnd = munchBalancedSubstringBlock(cx, line, attrStart, lbrkt, rbrkt);
    if (attrEnd != INLINE_FAIL) {
      pos = attrEnd;
      children.push(cx.elt("NotaInlineAttributes", attrStart, attrEnd));
      icx = makeInlineContext(cx, line);
    }

    let INDENT = 2;

    if (icx.char(pos) == colon) {
      // :
      pos += 1;

      if (pos < icx.end) {
        // " "
        if (icx.char(pos) == space) {
          pos += 1;
          children.push(notaInlineContentToLineEnd(icx, pos));
        }
      }

      let baseIndent = line.baseIndent;
      cx.startComposite("NotaBlockComponent", startRelative, INDENT);
      children.forEach(child => cx.addElement(child));

      while (cx.nextLine() && line.next == -1) {}

      if (line.next > -1 && line.baseIndent == baseIndent + INDENT) {
        cx.startComposite("NotaBlockContent", line.pos, 0);
        return BLOCK_CONTINUE;
      } else {
        return BLOCK_COMPLETE;
      }
    } else if (icx.char(pos) == lbrc) {
      // {
      let holeStart = pos + 1;
      pos = munchBalancedSubstringBlock(cx, line, pos, lbrc, rbrc);
      if (pos == INLINE_FAIL) return BLOCK_FAIL;
      children.push(cx.elt("NotaMdHole", holeStart, pos - 1));
      let mkComponent = (ty: string) => cx.elt(ty, start, pos, children);

      icx = makeInlineContext(cx, line);
      if (pos < icx.end) {
        let rest = cx.parser.parseInline(icx.slice(pos, icx.end), pos);
        cx.addElement(
          cx.elt("Paragraph", start, icx.end, [mkComponent("NotaInlineComponent"), ...rest])
        );
      } else {
        cx.addElement(mkComponent("NotaBlockComponent"));
      }

      cx.nextLine();
      return BLOCK_COMPLETE;
    } else if (pos == icx.end) {
      // EOL?

      cx.addElement(cx.elt("NotaBlockComponent", start, pos, children));
      cx.nextLine();
      return BLOCK_COMPLETE;
    } else {
      throw `TODO`;
    }
  }

  return BLOCK_FAIL;
};

let skipForNota = (_cx: BlockContext, line: Line, value: number): boolean => {
  if (line.indent < line.baseIndent + value && line.next > END_OF_LINE) return false;
  line.moveBaseColumn(line.baseIndent + value);
  return true;
};

export let notaCommandName = (cx: InlineContext, pos: number): Element | null => {
  if (cx.slice(pos, pos + 1).match(/\d/)) {
    return cx.elt("NotaCommandName", pos, pos + 1, [
      cx.elt("NotaCommandNameInteger", pos, pos + 1),
    ]);
  }

  let [balancedEnd] = munchBalancedSubstring(cx, pos, lparen, rparen);
  if (balancedEnd > INLINE_FAIL) {
    return cx.elt("NotaCommandName", pos, balancedEnd, [
      cx.elt("NotaCommandNameExpression", pos + 1, balancedEnd - 1, [
        cx.elt("NotaJs", pos + 1, balancedEnd - 1),
      ]),
    ]);
  } else {
    let identLength = munchIdent(cx.slice(pos, cx.end));
    if (identLength == INLINE_FAIL) return null;
    return cx.elt("NotaCommandName", pos, pos + identLength, [
      cx.elt("NotaCommandNameIdentifier", pos, pos + identLength),
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
    if (nameEl) {
      pos = nameEl.to;
      children.push(nameEl);
    }

    if (pos < cx.end && cx.char(pos) == lbrc) {
      cx.addDelimiter(NotaInterpolationDelimiter, start, pos, true, false);
      children.forEach(el => cx.addElement(el));
      return cx.addDelimiter(NotaInlineContentDelimiter, pos, pos + 1, true, false);
    } else {
      return cx.addElement(cx.elt("NotaInterpolation", start, pos, children));
    }
  }

  return INLINE_FAIL;
};

let notaInlineContentToLineEnd = (cx: InlineContext, pos: number): Element => {
  let end;
  if (cx.findOpeningDelimiter(NotaComponentDelimiter) !== null) {
    for (end = pos; end < cx.end; end++) {
      if (cx.char(end) == rbrc) break;
    }
  } else {
    let newlinePos = cx.slice(pos, cx.end).indexOf("\n");
    end = newlinePos > 0 ? pos + newlinePos : cx.end;
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

    // Component?
    if (cx.char(pos) != lbrc) {
      let nameEl = notaCommandName(cx, pos);
      if (!nameEl) return INLINE_FAIL;
      pos = nameEl.to;
      children.push(nameEl);
    }

    let fallback = () => cx.addElement(cx.elt("NotaInlineComponent", start, pos, children));

    if (pos == cx.end) return fallback();

    // [key: value, ...]
    let attrStart = pos;
    let [attrEnd] = munchBalancedSubstring(cx, attrStart, lbrkt, rbrkt);
    if (attrEnd != INLINE_FAIL) {
      pos = attrEnd;
      children.push(cx.elt("NotaInlineAttributes", attrStart, attrEnd));
    }

    if (pos == cx.end) return fallback();

    next = cx.char(pos);
    /*if (next == colon && pos < cx.end && cx.char(pos) == space) {
      let inlineContent = notaInlineContentToLineEnd(cx, pos + 1);
      pos = inlineContent.to;
      children.push(inlineContent);
      return fallback();
    } else*/ if (next == lbrc) {
      pos += 1;
      cx.addDelimiter(NotaComponentDelimiter, start, pos - 1, true, false);
      children.forEach(child => cx.addElement(child));
      cx.addDelimiter(NotaInlineContentDelimiter, pos - 1, pos, true, false);
      return pos;
    } else {
      return fallback();
    }
  }
  return INLINE_FAIL;
};

// TODO: rewrite this using stable APIs, i.e. findOpeningDelimiter
export let notaInlineEnd = (cx: InlineContext, next: number, pos: number): number => {
  let inside =
    cx.findOpeningDelimiter(NotaComponentDelimiter) != null ||
    cx.findOpeningDelimiter(NotaInterpolationDelimiter) != null;
  if (!inside) return INLINE_FAIL;

  let cxa = cx as any;
  if (!("braces" in cxa)) {
    cxa["braces"] = 0;
  }

  if (next == lbrc) {
    ++cxa["braces"];
  } else if (next == rbrc) {
    if (cxa["braces"] > 0) {
      --cxa["braces"];
    } else {
      cx.addDelimiter(NotaInlineContentDelimiter, pos, pos + 1, false, true);
      pos += 1;

      let afterWhitespace = cx.slice(pos, cx.end).match(/^\s*{/);
      if (afterWhitespace) {
        let n = afterWhitespace[0].length;
        cx.addDelimiter(NotaInlineContentDelimiter, pos + n - 1, pos + n, true, false);
        return pos + n;
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
              pos,
              children
            );
            parts[i] = component;

            return component.to;
          }
        }
      }
    }
  }

  return INLINE_FAIL;
};

// TODO: need to have a general mechanism for using this outside custom notations
// like $$..$$
export let notaTemplateBlock = (
  cx: BlockContext,
  line: Line,
  parseEnd: (cx: BlockContext, line: Line) => BlockResult
): Element => {
  let start = cx.lineStart;
  while (parseEnd(cx, line) === false) {
    if (!cx.nextLine()) break;
  }
  return cx.elt("NotaTemplateBlock", start, cx.prevLineEnd());
};

export type Terms = { [key: string]: number };
export let validateTermAccess = (terms: Terms): Terms =>
  new Proxy(terms, {
    get(target, prop, receiver) {
      if (!(prop in target)) {
        throw `Invalid key ${String(prop)}`;
      }

      return Reflect.get(target, prop, receiver);
    },
  });

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
    if (node.type.id == jsTerms.NotaCommand) {
      return { parser: parserRef };
    } else {
      return null;
    }
  });

  let jsParser: LRParser = baseJsParser.configure({ wrap: notaWrap });
  let exprParser = jsParser.configure({ top: "NotaExpr" });
  let attrParser = jsParser.configure({ top: "NotaInlineAttrs" });
  let stmtParser = jsParser.configure({ top: "NotaStmts" });
  let templateParser = jsParser.configure({ top: "NotaTemplateExternal" });

  let mdWrap = parseMixed((node, _input) => {
    switch (node.type.id) {
      case mdTerms.NotaAttributeValue:
        // TODO: when *any* overlay is added, the nested parse doesn't seem to work?
        return { parser: exprParser /*overlay: node => node.type.id == Type.NotaJs*/ };
      case mdTerms.NotaScriptBody:
        return { parser: stmtParser };
      case mdTerms.NotaInlineAttributes:
        return { parser: attrParser };
      case mdTerms.NotaJs:
        // for NotaCommandName
        return { parser: exprParser };
      case mdTerms.NotaTemplateBlock:
        return { parser: templateParser };
      case mdTerms.NotaMdHole:
        return { parser: parserRef };
    }

    return null;
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
      { name: "NotaCommandNameIdentifier", style: t.special(t.variableName) },
      { name: "NotaCommandNameInteger", style: t.special(t.variableName) },
      { name: "NotaCommandNameExpression" },
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
      { name: "NotaBlockContent", block: true, composite: () => true },
      { name: "NotaInlineComponentMark" },
      { name: "NotaInlineContentMark", style: t.brace },
      { name: "NotaTemplateBlock" },
      { name: "NotaMdHole" },
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
  mdTerms = validateTermAccess(
    _.fromPairs(
      parserRef.nodeSet.types
        .filter(node => node instanceof NodeType)
        .map(node => [node.name, node.id])
    )
  );

  return { mdParser: parserRef, mdTerms, jsParser };
};
