import { cli, ssrPlugin } from "@nota-lang/esbuild-utils";
import { notaPlugin } from "@nota-lang/nota-syntax/dist/esbuild-plugin";
import path from "path";

import { CommonOptions, nodePaths } from "./index.js";

export interface BuilderOptions {
  watch?: boolean;
}

export let main = async (opts: BuilderOptions & CommonOptions) => {
  let build = cli({ watch: opts.watch, debug: !opts.watch });
  let { dir, name } = path.parse(opts.file);
  let target = path.join(dir, name + ".html");
  await build({
    entryPoints: [target],
    outfile: "dist/index.mjs",
    preserveSymlinks: true,
    nodePaths,
    plugins: [notaPlugin({}), ssrPlugin(), ...(opts.config.plugins || [])],
  });
};
