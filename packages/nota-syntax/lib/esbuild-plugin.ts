import { resUnwrap } from "@nota-lang/nota-common/dist/result.js";
import type esbuild from "esbuild";
import fs from "fs";
import path from "path";

import { tryParse } from "./parse/mod.js";
import { printTree, translate } from "./translate/mod.js";

export interface NotaPluginOpts {}

const VERBOSE = true;

export let notaPlugin = (_opts: NotaPluginOpts): esbuild.Plugin => ({
  name: "notaSyntax",
  setup(build) {
    build.onLoad({ filter: /\.nota$/ }, async args => {
      let input = await fs.promises.readFile(args.path, "utf8");
      try {
        let tree = resUnwrap(tryParse(input));
        if (VERBOSE) {
          printTree(tree, input);
        }
        let { dir, base } = path.parse(args.path);
        let { code, map } = translate({
          input,
          tree,
          sourceRoot: dir,
          filenameRelative: base,
        });
        if (!code) {
          throw new Error("No code generated by Babel!");
        }
        if (map) {
          map.sources.push(args.path + ".js");
          map.sourcesContent?.push(code);

          let data = Buffer.from(JSON.stringify(map)).toString("base64");
          let mapEncoded = `data:application/json;charset=utf-8;base64,${data}`;
          code += `\n//# sourceMappingURL=${mapEncoded}`;
        }
        return { contents: code, loader: "js", resolveDir: path.dirname(args.path) };
      } catch (e: any) {
        return {
          errors: [
            {
              text: e.stack,
            },
          ],
        };
      }
    });
  },
});
