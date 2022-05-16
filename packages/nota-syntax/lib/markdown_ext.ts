import { parseMixed, Tree } from "@lezer/common";
import { LRParser } from "@lezer/lr";
import { Option, Some, None } from "@nota-lang/nota-common/dist/option-class.js";
import { Result, err, ok } from "@nota-lang/nota-common/dist/result.js";

import {
  BlockContext,
  BlockResult,
  InlineContext,
  Line,
  MarkdownConfig,
  MarkdownParser,
  parser as mdParser,
} from "./markdown.js";

//@ts-ignore
import { parser as baseNotaParser } from "./nota.grammar.js";
//@ts-ignore
import * as terms from "./nota.grammar.terms.js";

let [atSign, hash, pct, lbrc, rbrc, lbrkt, rbrkt] = ["@", "#", "%", "{", "}", "[", "]"].map(s =>
  s.charCodeAt(0)
);

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

export let NotaInlineParser = (cx: InlineContext, next: number, pos: number): number => {
  if (next == atSign || next == hash || next == pct) {
    let contents = cx.slice(pos, cx.end);
    let next_whitespace = contents.match(/\s/);
    if (next_whitespace && contents.slice(1, next_whitespace.index!).match(/^\w+$/)) {
      return 1 + next_whitespace.index!;
    }

    let length = findTokenTree(readSingleLine(contents));
    if (length instanceof None) {
      return -1;
    } else {
      return cx.addElement(cx.elt("NotaCommand", pos, pos + length.t));
    }
  } else {
    return -1;
  }
};

export let NotaBlockParser = (cx: BlockContext, line: Line): BlockResult => {
  let next = line.next;
  if (next == atSign || next == hash || next == pct) {
    let start = cx.parsedPos;
    let curLinePos = findTokenTree(readSingleLine(line.text));
    if (curLinePos instanceof Some && curLinePos.t < line.text.length) {
      return false;
    }

    let curLine = Some.mk(line.text);
    let readLine = () => {
      let ret = curLine;
      if (cx.nextLine()) {
        console.log("READ: ", line.text);
        curLine = Some.mk(line.text);
      } else {
        curLine = None.mk();
      }
      return ret;
    };

    let end = findTokenTree(readLine);
    if (end instanceof None) {
      throw `TODO: handle this case`;
    } else {
      cx.addElement(cx.elt("NotaCommand", start, start + end.t));
    }
    return true;
  }
  return false;
};

let notaWrap = parseMixed((node, _input) => {
  if (node.type.id == terms.Markdown) {
    return { parser: mdParser };
  } else {
    return null;
  }
});

let notaParser = baseNotaParser.configure({ wrap: notaWrap });

export let mdWrap = parseMixed((node, _input) => {
  if (node.name == "NotaCommand") {
    return { parser: notaParser };
  } else {
    return null;
  }
});