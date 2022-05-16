import { parseMixed, Tree } from "@lezer/common";
import { LRParser } from "@lezer/lr";
import { MarkdownConfig, MarkdownParser, parser as baseMdParser } from "@lezer/markdown";
import { Option, Some, None } from "@nota-lang/nota-common/dist/option-class.js";
import { Result, err, ok } from "@nota-lang/nota-common/dist/result.js";
import _ from "lodash";

import { parser as mdParser } from "./markdown.js";

//@ts-ignore
import { parser as baseNotaParser } from "./nota.grammar.js";
//@ts-ignore
import * as terms from "./nota.grammar.terms.js";

// let notaParser: LRParser;
// let mdParser: MarkdownParser;

// let notaWrap = parseMixed((node, _input) => {
//   if (node.type.id == terms.Markdown) {
//     return { parser: mdParser };
//   } else {
//     return null;
//   }
// });
// let mdWrap = parseMixed((node, _input) => {
//   if (node.name == "Nota") {
//     return { parser: notaParser };
//   } else {
//     return null;
//   }
// });

// let [atSign, hash, pct, lbrc, rbrc, lbrkt, rbrkt] = ["@", "#", "%", "{", "}", "[", "]"].map(s =>
//   s.charCodeAt(0)
// );

// let readSingleLine = (contents: string): (() => Option<string>) => {
//   let cell = Some.mk(contents);
//   return () => {
//     let ret = cell;
//     cell = None.mk();
//     return ret;
//   };
// };

// let findTokenTree = (readLine: () => Option<string>): Option<number> => {
//   let curLine = readLine().unwrap();
//   let linePos = 0;
//   let globalPos = 0;
//   let balance = { [lbrc]: 0, [lbrkt]: 0 };
//   let inverse = { [rbrc]: lbrc, [rbrkt]: lbrkt };
//   let seen = false;
//   let isBalanced = () => balance[lbrc] + balance[lbrkt] == 0;
//   while (
//     !seen ||
//     !isBalanced() ||
//     curLine.charCodeAt(linePos) == lbrc ||
//     curLine.charCodeAt(linePos) == lbrkt
//   ) {
//     let char = curLine.charCodeAt(linePos);
//     if (char == lbrc || char == lbrkt) {
//       seen = true;
//       balance[char] += 1;
//     } else if (char == rbrc || char == rbrkt) {
//       balance[inverse[char]] -= 1;
//     }

//     ++linePos;
//     ++globalPos;

//     if (linePos == curLine.length) {
//       let nextLine = readLine();
//       globalPos++; // for newline

//       while (nextLine instanceof Some && nextLine.t.length == 0) {
//         nextLine = readLine();
//         globalPos++;
//       }

//       if (nextLine instanceof Some) {
//         curLine = nextLine.t;
//         linePos = 0;
//       } else {
//         break;
//       }
//     }
//   }

//   if (isBalanced()) {
//     return Some.mk(globalPos);
//   } else {
//     return None.mk();
//   }
// };

// let Nota: MarkdownConfig = {
//   defineNodes: [
//     {
//       name: "Nota",
//     },
//     {
//       name: "NotaMark",
//     },
//   ],
//   parseInline: [
//     {
//       name: "Nota",
//       parse(cx, next, pos) {
//         let start = pos;
//         if (next == atSign || next == hash || next == pct) {
//           let contents = cx.slice(pos, cx.end);
//           let next_whitespace = contents.match(/\s/);
//           if (next_whitespace && contents.slice(1, next_whitespace.index!).match(/^\w+$/)) {
//             return 1 + next_whitespace.index!;
//           }

//           let length = findTokenTree(readSingleLine(contents));
//           if (length instanceof None) {
//             return -1;
//           } else {
//             return cx.addElement(cx.elt("Nota", start, start + length.t));
//           }
//         } else {
//           return -1;
//         }
//       },
//     },
//   ],
//   parseBlock: [
//     {
//       name: "Nota",
//       parse(cx, line) {
//         let next = line.next;
//         if (next == atSign || next == hash || next == pct) {
//           let start = cx.parsedPos;
//           let curLinePos = findTokenTree(readSingleLine(line.text));
//           if (curLinePos instanceof Some && curLinePos.t < line.text.length) {
//             return false;
//           }

//           let lines = [line.text];
//           let curLine = Some.mk(line.text);
//           let readLine = () => {
//             let ret = curLine;
//             if (cx.nextLine()) {
//               curLine = Some.mk(line.text);
//               lines.push(line.text);
//             } else {
//               curLine = None.mk();
//             }
//             return ret;
//           };

//           let end = findTokenTree(readLine);
//           if (end instanceof None) {
//             throw `TODO: handle this case`;
//           } else {
//             let minLeadingWhitespace = _.min(
//               lines.map(line => {
//                 let match = line.match(/^\s*/);
//                 if (match) {
//                   return match.index;
//                 } else {
//                   return 0;
//                 }
//               })
//             );
//             let contents = lines.map(line => line.slice(minLeadingWhitespace)).join('\n');
//             let tree = notaParser.parse(contents);
//             cx.addElement(cx.elt(tree, start));

//           }
//           return true;
//         }
//         return false;
//       },
//     },
//   ],
//   wrap: mdWrap,
// };

// mdParser = baseMdParser.configure([Nota]);
// notaParser = baseNotaParser.configure({ wrap: notaWrap });

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
