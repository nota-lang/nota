import { cli, ssr_plugin } from "@nota-lang/esbuild-utils";
import { nota_plugin } from "@nota-lang/nota-syntax/dist/esbuild-plugin";
import path from "path";

import { CommonOptions, nodePaths } from "./index";

export interface BuilderOptions {
  watch?: boolean;
}

export let main = async (opts: BuilderOptions & CommonOptions) => {
  let build = cli({ watch: opts.watch, debug: !opts.watch });
  let { dir, name } = path.parse(opts.file);
  let target = path.join(dir, name + ".html");
  await build({
    entryPoints: [target],
    outExtension: { ".js": ".mjs" },
    preserveSymlinks: true,
    nodePaths,
    plugins: [nota_plugin({}), ssr_plugin(), ...(opts.config.plugins || [])],
  });
};
