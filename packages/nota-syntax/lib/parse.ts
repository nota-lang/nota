import { Tree } from "@lezer/common";
import { Result, err, ok } from "@nota-lang/nota-common/dist/result.js";
import _ from "lodash";

import { parser as mdParser } from "./markdown.js";

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
