export { nota } from "./nota/language";
export { js } from "./javascript/language";

import { Result, ok, err } from "@wcrichto/nota-common";
import type { Tree } from "@lezer/common";

import { nota_language } from "./nota/language";

export let try_parse = (contents: string): Result<Tree> => {
  // Parse is @lezer/common/mix/MixedParse but this isn't an exported type
  let parse = nota_language.parser.startParse(contents) as any;
  while (true) {
    let tree = parse.advance();
    let base = parse.baseParse;
    if (base && base.recovering) {
      let pos = base.parsedPos - 1;
      let prefix = contents.slice(Math.max(0, pos - 10), pos);
      let suffix = contents.slice(pos + 1, pos + 10);
      let msg = `Invalid parse at: ${prefix}>>>${contents[pos]}<<<${suffix}`;
      if (base.tokens.mainToken) {
        let token = nota_language.parser.getName(base.tokens.mainToken.value);
        msg += ` (unexpected token ${token})`;
      }

      return err(Error(msg));
    } else if (tree != null) {
      return ok(tree);
    }
  }
};
