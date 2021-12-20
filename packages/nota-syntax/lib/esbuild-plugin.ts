import type esbuild from "esbuild";
import { unwrap } from "@nota-lang/nota-common";
import fs from "fs";

import { try_parse } from "./parse";
import { translate, nota_parser } from "./nota/translate";

export interface NotaPluginOpts {}

export let nota_plugin = (_opts: NotaPluginOpts): esbuild.Plugin => ({
  name: "nota_syntax",
  setup(build) {
    build.onLoad({ filter: /\.nota$/ }, async args => {
      let input = await fs.promises.readFile(args.path, "utf8");
      let tree = unwrap(try_parse(nota_parser, input));
      let js = translate(input, tree);
      return { contents: js, loader: "js" };
    });
  },
});
