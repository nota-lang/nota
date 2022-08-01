import { Plugin } from "esbuild";
import fs from "fs";
import { promise as glob } from "glob-promise";
import _ from "lodash";
import path from "path";

export interface CopyPluginOptions {
  extensions: string[];
}

/** Esbuild plugin that copies imported files with the given {@link CopyPluginOptions.extensions} into the `outdir`. */
export let copyPlugin = ({ extensions }: CopyPluginOptions): Plugin => ({
  name: "copy",
  setup(build) {
    let outdir = build.initialOptions.outdir;
    if (!outdir) {
      throw new Error(`outdir must be specified`);
    }

    let paths: [string, string][] = [];
    let filter = new RegExp(extensions.map(_.escapeRegExp).join("|"));
    build.onResolve({ filter }, async args => {
      let absPath = path.join(args.resolveDir, args.path);
      let matchingPaths = await glob(absPath);
      paths = paths.concat(matchingPaths.map(p => [p, path.join(outdir!, path.basename(p))]));
      return { path: args.path, namespace: "copy" };
    });

    build.onLoad({ filter: /.*/, namespace: "copy" }, async _args => ({ contents: "" }));
    build.onEnd(_ => {
      paths.forEach(([inPath, outPath]) => fs.promises.copyFile(inPath, outPath));
    });
  },
});
