import { parseMixed, Tree } from "@lezer/common";
import { LRParser } from "@lezer/lr";
import { MarkdownConfig, MarkdownParser, parser as baseMdParser } from "@lezer/markdown";
import { Result, err, ok } from "@nota-lang/nota-common/dist/result.js";

//@ts-ignore
import { parser as baseNotaParser } from "./nota.grammar.js";
//@ts-ignore
import * as terms from "./nota.grammar.terms.js";

let notaParser: LRParser;
let mdParser: MarkdownParser;

let notaWrap = parseMixed((node, _input) => {
  if (node.type.id == terms.Markdown) {
    return { parser: mdParser };
  } else {
    return null;
  }
});
let mdWrap = parseMixed((node, _input) => {
  if (node.name == "Nota") {
    return { parser: notaParser };
  } else {
    return null;
  }
});

let [atSign, hash, pct, lbrc, rbrc, lbrkt, rbrkt] = ["@", "#", "%", "{", "}", "[", "]"].map(s =>
  s.charCodeAt(0)
);

let findTokenTree = (contents: string): number => {
  let next_whitespace = contents.match(/\s/);
  if (next_whitespace && contents.slice(1, next_whitespace.index!).match(/^\w+$/)) {
    return 1 + next_whitespace.index!;
  }

  let end = 0;
  let balance = { [lbrc]: 0, [lbrkt]: 0 };
  let inverse = { [rbrc]: lbrc, [rbrkt]: lbrkt };
  let seen = false;
  while (
    end < contents.length &&
    (!seen ||
      balance[lbrc] + balance[lbrkt] > 0 ||
      contents.charCodeAt(end) == lbrc ||
      contents.charCodeAt(end) == lbrkt)
  ) {
    let char = contents.charCodeAt(end);
    if (char == lbrc || char == lbrkt) {
      seen = true;
      balance[char] += 1;
    } else if (char == rbrc || char == rbrkt) {
      balance[inverse[char]] -= 1;
    }
    ++end;
  }

  return end;
};

let Nota: MarkdownConfig = {
  defineNodes: [
    {
      name: "Nota",
    },
    {
      name: "NotaMark",
    },
  ],
  parseInline: [
    {
      name: "Nota",
      parse(cx, next, pos) {
        let start = pos;
        if (next == atSign || next == hash || next == pct) {
          let contents = cx.slice(pos, cx.end);
          let end = pos + findTokenTree(contents);
          return cx.addElement(cx.elt("Nota", start, end));
        } else {
          return -1;
        }
      },
    },
  ],
  parseBlock: [
    {
      name: "Nota",
      parse(cx, line) {
        let next = line.next;
        if (next == atSign || next == hash || next == pct) {
          let end = findTokenTree(line.text);
          if (end == line.text.length) {
            cx.addElement(cx.elt("Nota", cx.parsedPos, cx.parsedPos + line.text.length));
            cx.nextLine();
            return true;
          }
        }
        return false;
      },
    },
  ],
  wrap: mdWrap,
};

mdParser = baseMdParser.configure([Nota]);
notaParser = baseNotaParser.configure({ wrap: notaWrap });

export let parser = mdParser;

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
