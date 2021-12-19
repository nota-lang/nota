import type esbuild from "esbuild";
import { unwrap } from "@nota-lang/nota-common";
import fs from "fs";
import prettier from "prettier";

import { try_parse } from "./nota-syntax";
import { translate } from "./nota/translate";

export interface NotaPluginOpts {
  pretty?: boolean;
}

export let nota_plugin = (opts: NotaPluginOpts): esbuild.Plugin => ({
  name: "nota_syntax",
  setup(build) {
    build.onLoad({ filter: /\.nota$/ }, async args => {
      let input = await fs.promises.readFile(args.path, "utf8");
      let tree = unwrap(try_parse(input));
      let js = translate(input, tree);

      if (opts.pretty) {
        js = prettier.format(js, { parser: "babel" });
      }

      return { contents: js, loader: "js" };
    });
  },
});
