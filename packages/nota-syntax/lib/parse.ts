import type { Tree } from "@lezer/common";
import { Result, err, ok } from "@nota-lang/nota-common";

//@ts-ignore
import { parser } from "./nota.grammar";

export let try_parse = (contents: string): Result<Tree> => {
  // Parse is @lezer/common/mix/MixedParse but this isn't an exported type
  let parse = parser.configure({ strict: true }).startParse(contents) as any;
  while (true) {
    try {
      let tree = parse.advance();
      if (tree != null) {
        return ok(tree);
      }
    } catch (e: any) {
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
