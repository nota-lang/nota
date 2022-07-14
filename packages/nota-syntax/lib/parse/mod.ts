import { Tree } from "@lezer/common";
import { Strikethrough, Table, parser as baseMdParser } from "@lezer/markdown";
import { Result, err, ok } from "@nota-lang/nota-common/dist/result.js";

import { CommentExtension } from "./extensions/comment.js";
import { MathExtension } from "./extensions/math.js";
import { configureParserForNota } from "./extensions/nota.js";
import { RefExtension } from "./extensions/ref.js";

export { CodeTag } from "./highlight.js";
export { MathTag } from "./extensions/math.js";
export { configureParserForNota } from "./extensions/nota.js";

export let fullMdParser = baseMdParser.configure([
  CommentExtension,
  MathExtension,
  RefExtension,
  Strikethrough,
  Table,
]);
export let { mdParser, mdTerms, jsParser, jsTerms } = configureParserForNota(fullMdParser);

export let tryParse = (contents: string): Result<Tree> => {
  let parse = mdParser.startParse(contents);
  while (true) {
    try {
      let tree = parse.advance();
      if (tree != null) {
        return ok(tree);
      }
    } catch (e: any) {
      if (e.constructor.name == "SyntaxError") {
        let pos = parseInt(e.toString().match(/\d+$/)[0]);
        let prefix = contents.slice(Math.max(0, pos - 10), pos);
        let suffix = contents.slice(pos + 1, pos + 10);
        let msg = `Invalid parse at: "${prefix}>>>${
          pos == contents.length ? "(end of file)" : contents[pos]
        }<<<${suffix}"`;
        return err(Error(msg));
      } else {
        throw e;
      }
    }
  }
};
