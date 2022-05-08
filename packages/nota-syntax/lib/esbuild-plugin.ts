import { resUnwrap } from "@nota-lang/nota-common/dist/result";
import type esbuild from "esbuild";
import fs from "fs";
import path from "path";

import { tryParse } from "./parse.js";
import { translate } from "./translate.js";

export interface NotaPluginOpts {}

export let notaPlugin = (_opts: NotaPluginOpts): esbuild.Plugin => ({
  name: "notaSyntax",
  setup(build) {
    build.onLoad({ filter: /\.nota$/ }, async args => {
      let input = await fs.promises.readFile(args.path, "utf8");
      let tree = resUnwrap(tryParse(input));
      let js = translate(input, tree);
      return { contents: js, loader: "js", resolveDir: path.dirname(args.path) };
    });
  },
});
