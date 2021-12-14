import type esbuild from "esbuild";
import { unwrap } from "@wcrichto/nota-common";
import fs from "fs";

import { try_parse } from "./nota-syntax";
import { translate } from "./translate";

export let nota_plugin: () => esbuild.Plugin = () => ({
  name: "nota_syntax",
  setup(build) {
    build.onLoad({ filter: /\.nota$/ }, async args => {
      let input = await fs.promises.readFile(args.path, "utf8");
      let tree = unwrap(try_parse(input));
      let js = translate(input, tree);
      return { contents: js, loader: "js" };
    });
  },
});
