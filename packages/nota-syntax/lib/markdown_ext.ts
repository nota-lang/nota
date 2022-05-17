import { parseMixed, Tree } from "@lezer/common";
import { LRParser } from "@lezer/lr";
import { Option, Some, None } from "@nota-lang/nota-common/dist/option-class.js";
import { Result, err, ok } from "@nota-lang/nota-common/dist/result.js";
import { nota } from "./language.js";

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
  Mark,
  MarkdownConfig,
  MarkdownParser,
  parser as mdParser,
  TreeElement,
  Type,
} from "./markdown.js";

//@ts-ignore
import { parser as baseNotaParser } from "./nota.grammar.js";
//@ts-ignore
import * as terms from "./nota.grammar.terms.js";

let [atSign, hash, pct, lbrc, rbrc, lbrkt, rbrkt, colon, newline, pipe, space] = [
  "@",
  "#",
  "%",
  "{",
  "}",
  "[",
  "]",
  ":",
  "\n",
  "|",
  " ",
].map(s => s.charCodeAt(0));

let readSingleLine = (contents: string): (() => Option<string>) => {
  let cell = Some.mk(contents);
  return () => {
    let ret = cell;
    cell = None.mk();
    return ret;
  };
};

let findTokenTree = (readLine: () => Option<string>): Option<number> => {
  let curLine = readLine().unwrap();
  let linePos = 0;
  let globalPos = 0;
  let balance = { [lbrc]: 0, [lbrkt]: 0 };
  let inverse = { [rbrc]: lbrc, [rbrkt]: lbrkt };
  let seen = false;
  let isBalanced = () => balance[lbrc] + balance[lbrkt] == 0;
  while (
    !seen ||
    !isBalanced() ||
    curLine.charCodeAt(linePos) == lbrc ||
    curLine.charCodeAt(linePos) == lbrkt
  ) {
    let char = curLine.charCodeAt(linePos);
    if (char == lbrc || char == lbrkt) {
      seen = true;
      balance[char] += 1;
    } else if (char == rbrc || char == rbrkt) {
      balance[inverse[char]] -= 1;
    }

    ++linePos;
    ++globalPos;

    if (linePos == curLine.length) {
      let nextLine = readLine();
      globalPos++; // for newline

      while (nextLine instanceof Some && nextLine.t.length == 0) {
        nextLine = readLine();
        globalPos++;
      }

      if (nextLine instanceof Some) {
        curLine = nextLine.t;
        linePos = 0;
      } else {
        break;
      }
    }
  }

  if (isBalanced()) {
    return Some.mk(globalPos);
  } else {
    return None.mk();
  }
};

let munchChar = (text: string, pos: number, char: number): number => {
  if (text.charCodeAt(pos) != char) {
    return -1;
  }
  return 1;
};

let munchIdent = (text: string, pos: number): number => {
  let match = text.slice(pos).match(/^\w+/);
  if (!match) {
    return -1;
  }
  return match[0].length;
};

// marks.push(elt(Type.NotaJs, cx.lineStart + indent, cx.lineStart + line.text.length));
// }
// } while (cx.nextLine() && line.depth >= cx.stack.length);

// children.push(
// new TreeElement(
//   cx.buffer
//     .writeElements(marks, -from)
//     .finish(Type.NotaAttributeValue, cx.prevLineEnd() - from),
//   from
// )

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
  }

  return false;
};

export let notaBlockAttributeParser = (cx: BlockContext, line: Line): BlockResult => {
  if (line.next == pipe) {
    let attrStart = cx.lineStart + line.basePos;
    let pos = line.pos + 1;

    if (munchChar(line.text, pos, space) == -1) return false;
    pos += 1;

    let identStart = pos;
    let identLength = munchIdent(line.text, identStart);
    if (identLength == -1) return false;
    pos += identLength;

    if (munchChar(line.text, pos, colon) == -1) return false;
    pos += 1;

    let children: (Element | TreeElement)[] = [
      elt(
        Type.NotaAttributeKey,
        cx.lineStart + identStart,
        cx.lineStart + identStart + identLength
      ),
    ];

    if (pos == line.text.length) {
      let indent = line.baseIndent + 2;

      cx.nextLine();
      let from = cx.lineStart + line.basePos;

      let marks: Element[] = [];
      do {
        if (line.pos == line.text.length) {
          // Empty
        } else if (line.indent < indent) {
          break;
        } else {
          marks.push(elt(Type.NotaJs, cx.lineStart + indent, cx.lineStart + line.text.length));
        }
      } while (cx.nextLine() && line.depth >= cx.stack.length);

      children.push(
        new TreeElement(
          cx.buffer
            .writeElements(marks, -from)
            .finish(Type.NotaAttributeValue, cx.prevLineEnd() - from),
          from
        )
      );
    } else {
      if (munchChar(line.text, pos, space) == -1) return false;
      pos += 1;

      children.push(
        elt(Type.NotaAttributeValue, cx.lineStart + pos, cx.lineStart + line.text.length)
      );

      cx.nextLine();
    }

    cx.addElement(elt(Type.NotaAttribute, attrStart, cx.prevLineEnd(), children));

    return true;
  }

  return false;
};

export let notaBlockComponentParser = (cx: BlockContext, line: Line): BlockResult => {
  let next = line.next;
  if (next == atSign) {
    let pos = line.pos + 1;
    let identLength = munchIdent(line.text, pos);
    if (identLength == -1) return false;
    pos += identLength;

    if (munchChar(line.text, pos, colon) == -1) return false;
    pos += 1;

    // TODO: lineStart vs absoluteLineStart?
    let start = cx.lineStart + line.basePos;
    if (pos == line.text.length) {
      let INDENT = 2;
      cx.startContext(Type.NotaComponent, start, INDENT);
      cx.addNode(Type.NotaIdent, start + 1, start + 1 + identLength);
      cx.nextLine();

      return null;
    } else {
      if (munchChar(line.text, pos, space) == -1) return false;
      pos += 1;

      cx.addElement(
        elt(Type.NotaComponent, start, start + line.text.length, [
          elt(Type.NotaIdent, start + 1, start + 1 + identLength),
          elt(
            Type.NotaInlineSequence,
            start + pos,
            start + line.text.length,
            cx.parser.parseInline(line.text.slice(pos), start + pos)
          ),
        ])
      );
      cx.nextLine();
      return true;
    }
  }
  return false;
};

const NotaInlineComponentDelimiter: DelimiterType = {
  resolve: "NotaInlineComponent",
  mark: "NotaInlineComponentMark",
};

/* TODO: 
 * - [bracket attributes] for block and inline elements
 * - #-interpolations
 */
export let notaInlineParser = (cx: InlineContext, next: number, pos: number): number => {
  if (next == atSign || next == hash) {
    let start = pos;
    pos += 1;

    let identLength = munchIdent(cx.text, pos);
    if (identLength == -1) return -1;
    pos += identLength;

    console.log(cx.text, identLength, pos);

    next = cx.text.charCodeAt(pos);
    pos += 1;
    if (next == colon) {
      return cx.addElement(
        elt(
          Type.NotaComponent,
          start,
          cx.text.length,
          cx.parser.parseInline(cx.text.slice(pos), pos)
        )
      );
    } else if (next == lbrc) {
      return cx.addDelimiter(NotaInlineComponentDelimiter, start, pos, true, false);
    } else {
      return -1;
    }
  } else if (next == rbrc) {
    for (let i = cx.parts.length - 1; i >= 0; i--) {
      let part = cx.parts[i];
      if (part instanceof InlineDelimiter && part.type == NotaInlineComponentDelimiter) {
        let content = cx.takeContent(i);
        let component = elt(Type.NotaComponent, part.from, pos + 1, content);
        cx.parts[i] = component;
        return component.to;
      }
    }
  }
  return -1;
};

export let skipForNota = (bl: CompositeBlock, cx: BlockContext, line: Line): boolean => {
  if (line.indent < line.baseIndent + bl.value && line.next > -1) {
    return false;
  }
  line.moveBaseColumn(line.baseIndent + bl.value);
  return true;
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
let notaStmtParser = notaParser.configure({ top: "NotaStmts" });

export let mdWrap = parseMixed((node, _input) => {
  if (node.type.id == Type.NotaAttributeValue) {
    // TODO: when *any* overlay is added, the nested parse doesn't seem to work?
    return { parser: notaExprParser /*overlay: node => node.type.id == Type.NotaJs*/ };
  }
  if (node.type.id == Type.NotaScript) {
    return { parser: notaStmtParser };
  } else {
    return null;
  }
});
