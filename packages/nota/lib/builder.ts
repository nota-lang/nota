import { cli, ssr_plugin } from "@nota-lang/esbuild-utils";
import { nota_plugin } from "@nota-lang/nota-syntax/dist/esbuild-plugin";
import { CommonOptions } from "./nota";
import path from "path";

export interface BuilderOptions {}

export let main = async (opts: BuilderOptions & CommonOptions) => {
  let build = cli({ debug: true });
  let { dir, name } = path.parse(opts.file);
  let target = path.join(dir, name + ".html");
  await build({
    entryPoints: [target],
    outExtension: { ".js": ".mjs" },
    preserveSymlinks: true,
    plugins: [nota_plugin({}), ssr_plugin(), ...(opts.config.plugins || [])],
  });
};
