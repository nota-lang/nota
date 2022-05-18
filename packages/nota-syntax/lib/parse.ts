import { parseMixed } from "@lezer/common";
import { LRParser } from "@lezer/lr";
import { Tree } from "@lezer/common";
import { Result, err, ok } from "@nota-lang/nota-common/dist/result.js";
import _ from "lodash";
import {
  InlineContext,
  BlockContext,
  Line,
  Element,
  DelimiterType,
  parser as mdParser,
  MarkdownConfig,
  NodeSpec,
} from "@lezer/markdown";

//@ts-ignore
import { parser as baseNotaParser } from "./nota.grammar.js";
//@ts-ignore
import * as terms from "./nota.grammar.terms.js";

export enum Type {
  Document = 1,

  CodeBlock,
  FencedCode,
  Blockquote,
  HorizontalRule,
  BulletList,
  OrderedList,
  ListItem,
  ATXHeading1,
  ATXHeading2,
  ATXHeading3,
  ATXHeading4,
  ATXHeading5,
  ATXHeading6,
  SetextHeading1,
  SetextHeading2,
  HTMLBlock,
  LinkReference,
  Paragraph,
  CommentBlock,
  ProcessingInstructionBlock,

  // Inline
  Escape,
  Entity,
  HardBreak,
  Emphasis,
  StrongEmphasis,
  Link,
  Image,
  InlineCode,
  HTMLTag,
  Comment,
  ProcessingInstruction,
  URL,

  // Smaller tokens
  HeaderMark,
  QuoteMark,
  ListMark,
  LinkMark,
  EmphasisMark,
  CodeMark,
  CodeText,
  CodeInfo,
  LinkTitle,
  LinkLabel,
}

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

type BlockResult = boolean | null;

export let notaScriptParser = (cx: BlockContext, line: Line): BlockResult => {
  if (line.next == pct) {
    let start = cx.lineStart;
    if (line.text.length >= 3 && line.text.slice(0, 3) == "%%%") {
      let marks: Element[] = [];
      while (cx.nextLine()) {
        if (line.text == "%%%") break;
        marks.push(cx.elt("NotaJs", cx.lineStart, cx.lineStart + line.text.length));
      }
      cx.nextLine();
      cx.addElement(cx.elt("NotaScript", start + 3, cx.prevLineEnd() - 3, marks));
    } else {
      cx.addElement(
        cx.elt("NotaScript", cx.lineStart + 1, cx.lineStart + line.text.length, [
          cx.elt("NotaJs", cx.lineStart + 1, cx.lineStart + line.text.length),
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

// @Component{(key: value),*}: inline?
//   | key: value
//   sub-block
export let notaBlockComponentParser = (cx: BlockContext, line: Line): BlockResult => {
  let next = line.next;
  if (next == atSign) {
    let pos = cx.lineStart + line.pos;
    let icx = new (InlineContext as any)(
      cx.parser,
      line.text.slice(line.pos),
      pos
    ) as InlineContext;
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
      children.push(cx.elt("NotaInlineAttributes", attrStart, attrEnd));
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
    cx.nextLine();
    if (line.next == -1) {
      return true;
    } else {
      return null;
    }
  }

  return false;
};

export let skipForNota = (_cx: BlockContext, line: Line, value: number): boolean => {
  if (line.indent < line.baseIndent + value && line.next > -1) return false;

  line.moveBaseColumn(line.baseIndent + value);
  return true;
};

let notaCommandName = (cx: InlineContext, pos: number): Element | null => {
  let balancedEnd = munchBalancedSubstring(cx, pos, lparen, rparen);
  if (balancedEnd > -1) {
    return cx.elt("NotaCommandName", pos, balancedEnd, [
      cx.elt("NotaJs", pos + 1, balancedEnd - 1),
    ]);
  } else {
    let identLength = munchIdent(cx.slice(pos, cx.end));
    if (identLength == -1) return null;
    return cx.elt("NotaCommandName", pos, pos + identLength);
  }
};

const NotaComponentDelimiter: DelimiterType = {};
const NotaInterpolationDelimiter: DelimiterType = {};
const NotaInlineContentDelimiter: DelimiterType = {
  resolve: "NotaInlineContent",
  mark: "NotaInlineContentMark",
};

export let notaInterpolationStart = (cx: InlineContext, next: number, pos: number): number => {
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
      return cx.addElement(cx.elt("NotaInterpolation", start, pos, [nameEl]));
    }
  }

  return -1;
};

let notaInlineContentToLineEnd = (cx: InlineContext, pos: number): Element => {
  let children = cx.parser.parseInline(cx.slice(pos, cx.end), pos);
  return cx.elt("NotaInlineContent", pos, cx.end, children);
};

export let notaInlineComponentStart = (cx: InlineContext, next: number, pos: number): number => {
  if (next == atSign) {
    let start = pos;
    pos += 1;

    let nameEl = notaCommandName(cx, pos);
    if (!nameEl) return -1;
    pos = nameEl.to;

    let children = [nameEl];
    let fallback = () => cx.addElement(cx.elt("NotaInlineComponent", start, cx.end, children));

    if (pos == cx.end) return fallback();

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

let notaWrap = parseMixed((node, _input) => {
  if (node.type.id == terms.Markdown) {
    return { parser };
  } else {
    return null;
  }
});

let notaParser: LRParser = baseNotaParser.configure({ wrap: notaWrap });
let notaExprParser = notaParser.configure({ top: "NotaExpr" });
let notaAttrParser = notaParser.configure({ top: "NotaInlineAttrs" });
let notaStmtParser = notaParser.configure({ top: "NotaStmts" });

export let mdWrap = parseMixed((node, _input) => {
  if (node.name == "NotaAttributeValue") {
    // TODO: when *any* overlay is added, the nested parse doesn't seem to work?
    return { parser: notaExprParser /*overlay: node => node.type.id == Type.NotaJs*/ };
  } else if (node.name == "NotaScript") {
    return { parser: notaStmtParser };
  } else if (node.name == "NotaInlineAttributes") {
    return { parser: notaAttrParser };
  } else {
    return null;
  }
});

let NotaMarkdown: MarkdownConfig = {
  defineNodes: [
    {
      name: "NotaBlockComponent",
      block: true,
      composite: skipForNota,
    },
    { name: "NotaInlineComponent" },
    { name: "NotaInterpolation" },
    { name: "NotaCommandName" },
    { name: "NotaInlineAttributes" },
    {
      name: "NotaBlockAttribute",
      block: true,
    },
    { name: "NotaAttributeKey" },
    { name: "NotaAttributeValue" },
    { name: "NotaScript" },
    { name: "NotaJs" },
    { name: "NotaInlineContent" },
    { name: "NotaInlineComponentMark" },
    { name: "NotaInlineContentMark" },
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

export let parser = mdParser.configure([NotaMarkdown]);

export let MdTermsExt: { [key: string]: number } = _.fromPairs(
  NotaMarkdown.defineNodes!.map(node => {
    let name = (node as NodeSpec).name;
    return [name, parser.nodeSet.types.find(nodeType => nodeType.name == name)!.id];
  })
);

export let tryParse = (contents: string): Result<Tree> => {
  // TODO: configure markdown as strict?
  let parse = parser.startParse(contents);
  while (true) {
    try {
      let tree = parse.advance();
      if (tree != null) {
        return ok(tree);
      }
    } catch (e: any) {
      console.error(e);
      let pos = parseInt(e.toString().match(/\d+$/)[0]);
      let prefix = contents.slice(Math.max(0, pos - 10), pos);
      let suffix = contents.slice(pos + 1, pos + 10);
      let msg = `Invalid parse at: "${prefix}>>>${
        pos == contents.length ? "(end of file)" : contents[pos]
      }<<<${suffix}"`;
      return err(Error(msg));
    }
  }
};
”