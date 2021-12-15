import generator from "@lezer/generator";
import type { Plugin } from "esbuild";
import _ from "lodash";
import fs from "fs/promises";
import path from "path";

export let lezerPlugin = (): Plugin => ({
  name: "lezer",
  setup(build) {
    let cache = new Map();
    build.onLoad({ filter: /\.grammar$/,}, async args => {
      let input = await fs.readFile(args.path, "utf8");

      let key = args.path;
      let value = cache.get(key);
      if (!value || value.input != input) {
        console.debug("Generating grammar:", path.basename(args.path));
        let { parser, terms } = generator.buildParserFile(input, {
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
