import type esbuild from "esbuild";
import { res_unwrap } from "@nota-lang/nota-common";
import fs from "fs";
import path from "path";

import { try_parse } from "./parse";
import { translate } from "./translate";

export interface NotaPluginOpts {}

export let nota_plugin = (_opts: NotaPluginOpts): esbuild.Plugin => ({
  name: "nota_syntax",
  setup(build) {
    build.onLoad({ filter: /\.nota$/ }, async args => {
      let input = await fs.promises.readFile(args.path, "utf8");
      let tree = res_unwrap(try_parse(input));
      let js = translate(input, tree);
      return { contents: js, loader: "js", resolveDir: path.dirname(args.path) };
    });
  },
});
