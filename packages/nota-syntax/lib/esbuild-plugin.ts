import { isOk } from "@nota-lang/nota-common/dist/result.js";
import type esbuild from "esbuild";
import fs from "fs";
import path from "path";

import { tryParse } from "./parse/mod.js";
import { printTree, translate } from "./translate/mod.js";

export interface NotaPluginOpts {
  debugExports?: boolean;
  extraCss?: string[];
}

const VERBOSE = false;

export let notaPlugin = ({ debugExports, extraCss }: NotaPluginOpts = {}): esbuild.Plugin => ({
  name: "notaSyntax",
  setup(build) {
    build.onLoad({ filter: /\.nota$/ }, async args => {
      let input = await fs.promises.readFile(args.path, "utf8");

      let tree = tryParse(input);
      if (!isOk(tree)) {
        return { errors: [{ text: `Parse error: ${tree.value}` }] };
      }
      if (VERBOSE) {
        printTree(tree.value, input);
      }

      let code, map;
      try {
        let result = translate({
          input,
          tree: tree.value,
          inputPath: args.path,
          debugExports,
          extraCss,
        });
        code = result.code;
        map = result.map;
      } catch (e: any) {
        return { errors: [{ text: `Internal compiler error: ${e.stack}` }] };
      }

      if (map) {
        let data = Buffer.from(JSON.stringify(map)).toString("base64");
        let mapEncoded = `data:application/json;charset=utf-8;base64,${data}`;
        code += `\n//# sourceMappingURL=${mapEncoded}`;
      }

      return {
        contents: code,
        loader: "js",
        resolveDir: path.dirname(args.path),
      };
    });
  },
});
