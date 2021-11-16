//@ts-ignore
import {parser} from "./nota.grammar";
import type esbuild from "esbuild";
import fs from "fs";
import { translate } from "./translate";

export let notaSyntax: () => esbuild.Plugin = () => ({
  name: "syntax",
  setup(build) {
    build.onLoad({ filter: /\.nota$/ }, async args => {
      let input = await fs.promises.readFile(args.path, "utf8");
      let tree = parser.parse(input);
      let {js, imports: _todo} = translate(input, tree);
      return {contents: js, loader: 'js'};   
    });
  },
});
