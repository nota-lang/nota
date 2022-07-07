import { NodeType, parseMixed } from "@lezer/common";
import { tags as t } from "@lezer/highlight";
import { LRParser } from "@lezer/lr";
import {
  BlockContext,
  BlockParser,
  DelimiterType,
  Element,
  InlineContext,
  InlineParser,
  LeafBlock,
  Line,
  MarkdownConfig,
  MarkdownParser,
} from "@lezer/markdown";
import _ from "lodash";

import { mdTerms } from "../mod.js";
//@ts-ignore
import { parser as baseJsParser } from "../notajs.grammar.js";
//@ts-ignore
import * as jsTerms from "../notajs.grammar.terms.js";

const [
  atSign,
  hash,
  pct,
  lbrc,
  rbrc,
  lparen,
  rparen,
  lbrkt,
  rbrkt,
  colon,
  pipe,
  space,
  bslash,
  period,
] = ["@", "#", "%", "{", "}", "(", ")", "[", "]", ":", "|", " ", "\\", "."].map(s =>
  s.charCodeAt(0)
);

const BLOCK_COMPLETE = true;
const BLOCK_FAIL = false;
const BLOCK_CONTINUE: null = null;
const INLINE_FAIL = -1;
const END_OF_LINE = -1;
export type BlockResult = boolean | null;

const INDENT = 2;

let makeInlineContext = (cx: BlockContext, line: Line): InlineContext =>
  new (InlineContext as any)(cx.parser, line.text.slice(line.pos), cx.lineStart + line.pos);

let munchIdent = (text: string): number => {
  // TODO: handle unicode
  let match = text.match(/^[_\w$][_$\w\d]*/);
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

class NotaScriptParser implements BlockParser {
  name = "NotaScript";

  parse(cx: BlockContext, line: Line): BlockResult {
    if (line.next == pct) {
      let start = cx.lineStart;
      let text = line.text.slice(line.pos);
      if (text.startsWith("%%%")) {
        let openDelim = cx.elt("%%%", start, start + 3);
        let marks: Element[] = [];
        while (cx.nextLine()) {
          text = line.text.slice(line.pos);
          if (line.text.endsWith("%%%")) {
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
  }
}

class NotaBlockAttributeParser implements BlockParser {
  name = "NotaBlockAttribute";

  parse(cx: BlockContext, line: Line): BlockResult {
    if (line.next == pipe) {
      let icx = makeInlineContext(cx, line);
      let pos = icx.offset;
      let startRelative = line.pos;

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

      if (pos < icx.end) {
        // " "
        if (icx.char(pos) == space) {
          pos += 1;
          children.push(notaInlineContentToLineEnd(icx, pos));
        }
      }

      let baseIndent = line.baseIndent;
      cx.startComposite("NotaBlockAttribute", startRelative, baseIndent + INDENT);
      children.forEach(child => cx.addElement(child));

      while (cx.nextLine() && line.next == -1);

      if (line.next > -1 && line.baseIndent == baseIndent + INDENT) {
        cx.startComposite("NotaBlockContent", line.pos, baseIndent + INDENT);
        return BLOCK_CONTINUE;
      } else {
        return BLOCK_COMPLETE;
      }
    }

    return BLOCK_FAIL;
  }
}

// @Component[(key: value),*]: inline?
//   | key: value
//   sub-block
class NotaBlockComponentParser implements BlockParser {
  name = "NotaBlockComponent";

  parse(cx: BlockContext, line: Line): BlockResult {
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
      if (nameEl) {
        pos = nameEl.to;
        children.push(nameEl);
      }

      // [(key: value),*]
      let attrStart = pos;
      let attrEnd = munchBalancedSubstringBlock(cx, line, attrStart, lbrkt, rbrkt);
      if (attrEnd != INLINE_FAIL) {
        pos = attrEnd;
        children.push(cx.elt("NotaInlineAttributes", attrStart, attrEnd));
        icx = makeInlineContext(cx, line);
      }

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
        cx.startComposite("NotaBlockComponent", startRelative, baseIndent + INDENT);
        children.forEach(child => cx.addElement(child));

        while (cx.nextLine() && line.next == -1);

        if (line.next > -1 && line.baseIndent == baseIndent + INDENT) {
          cx.startComposite("NotaBlockContent", line.pos, baseIndent + INDENT);
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

        if (pos < cx.lineStart + line.text.length) {
          return BLOCK_FAIL;
        }

        cx.addElement(cx.elt("NotaBlockComponent", start, pos, children));
        cx.nextLine();

        return BLOCK_COMPLETE;
      } else if (pos == icx.end) {
        // EOL?

        cx.addElement(cx.elt("NotaBlockComponent", start, pos, children));
        cx.nextLine();
        return BLOCK_COMPLETE;
      } else {
        return BLOCK_FAIL;
      }
    }

    return BLOCK_FAIL;
  }

  endLeaf(cx: BlockContext, line: Line, _leaf: LeafBlock): boolean {
    let stack = (cx as any).stack;
    if (stack.length >= 1) {
      let block = stack[stack.length - 1];
      return block.type == mdTerms.NotaBlockContent && line.indent < block.value;
    }
    return false;
  }
}

let skipForNota = (_cx: BlockContext, line: Line, value: number): boolean => {
  // console.log(
  //   _cx.parentType().name,
  //   "indent",
  //   line.indent,
  //   "baseIndent",
  //   line.baseIndent,
  //   "value",
  //   value,
  //   "part of block?",
  //   !(line.indent < line.baseIndent + value && line.next > END_OF_LINE),
  //   "text",
  //   line.text
  // );
  if (line.indent < value && line.next > END_OF_LINE) return false;
  line.moveBaseColumn(value);
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

class NotaInterpolationStartParser implements InlineParser {
  name = "NotaInterpolationStart";

  parse(cx: InlineContext, next: number, pos: number): number {
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
  }
}

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

class NotaInlineComponentStartParser implements InlineParser {
  name = "NotaInlineComponentStart";

  parse(cx: InlineContext, next: number, pos: number): number {
    if (next == atSign || (next == period && cx.char(pos + 1) == atSign)) {
      let start = pos;

      // @
      let sigilSize = next == period ? 2 : 1;
      let children = [cx.elt("@", pos, pos + sigilSize)];
      pos += sigilSize;

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
  }
}

class NotaInlineEndParser implements InlineParser {
  name = "NotaInlineEnd";

  // TODO: rewrite this using stable APIs, i.e. findOpeningDelimiter
  parse(cx: InlineContext, next: number, pos: number): number {
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
  }
}

export let notaTemplateInline = (cx: InlineContext, pos: number, delim: number): Element => {
  let start = pos;
  let children = [];
  while (pos < cx.end) {
    if (pos < cx.end - 1 && cx.char(pos) == bslash && cx.char(pos + 1) == delim) {
      children.push(cx.elt("Escape", pos, pos + 2));
      pos += 2;
    } else if (cx.char(pos) == delim) {
      break;
    }
    pos++;
  }
  return cx.elt("NotaTemplateBlock", start, pos, children);
};

export let notaTemplateBlock = (
  cx: BlockContext,
  line: Line,
  parseEnd: (cx: BlockContext, line: Line) => BlockResult
): Element => {
  let start = cx.lineStart + line.pos;
  let children = [];
  while (parseEnd(cx, line) === BLOCK_FAIL) {
    children.push(
      cx.elt("NotaTemplateMark", cx.lineStart + line.pos, cx.lineStart + line.text.length)
    );
    if (!cx.nextLine()) break;
  }
  return cx.elt("NotaTemplateBlock", start, cx.prevLineEnd(), children);
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
        // OK: we seem to get the issue. When you use `overlay`, rather than replacing
        // the node, this "mounts" an "overlaid" tree. But the API for accessing these
        // seems really wonky. Need to ask Marijn about this.
        //
        // let overlay = node.node
        //   .getChildren(mdTerms.NotaTemplateMark)
        //   .map(node => ({ from: node.from, to: node.to }));
        return {
          parser: templateParser,
          // overlay,
        };
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
        composite: skipForNota,
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
      { name: "NotaTemplateMark" },
      { name: "NotaMdHole" },
      { name: "@", style: t.modifier },
      { name: "#", style: t.modifier },
      { name: "%", style: t.modifier },
      { name: "%%%", style: t.modifier },
    ],
    parseBlock: [
      new NotaScriptParser(),
      new NotaBlockAttributeParser(),
      new NotaBlockComponentParser(),
    ],
    parseInline: [
      new NotaInlineComponentStartParser(),
      new NotaInlineEndParser(),
      new NotaInterpolationStartParser(),
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
