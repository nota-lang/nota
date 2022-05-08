/**
 * An esbuild plugin that allows [Lezer grammars](https://lezer.codemirror.net/) to be loaded.
 * @module
 */

import { buildParserFile } from "@lezer/generator";
import type { Plugin } from "esbuild";
import fs from "fs/promises";
import path from "path";

/** Runs Lezer on all `*.grammar` files.
 *
 * Rather than generating two separate files like Lezer normally does (the grammar and the terms),
 * this plugin combines them into one file that exports both. So you can do something like:
 * ```js
 * import {parser, * as terms} from "./foo.grammar";
 * ```
 */
export let lezerPlugin = (): Plugin => ({
  name: "lezer",
  setup(build) {
    let cache = new Map();
    build.onLoad({ filter: /\.grammar$/ }, async args => {
      let input = await fs.readFile(args.path, "utf8");

      let key = args.path;
      let value = cache.get(key);
      if (!value || value.input != input) {
        console.debug("Generating grammar:", path.basename(args.path));
        let { parser, terms } = buildParserFile(input, {
          fileName: args.path,
          includeNames: true,
        });
        let contents = parser + terms;
        value = { input, contents };
        cache.set(key, value);
      }

      return {
        contents: value.contents,
        loader: "js",
        resolveDir: path.dirname(args.path),
      };
    });
  },
});
