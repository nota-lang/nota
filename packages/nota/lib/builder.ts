import { cli, log, ssrPlugin } from "@nota-lang/esbuild-utils";
import { notaPlugin } from "@nota-lang/nota-syntax/dist/esbuild-plugin.js";
import fs from "fs-extra";
import path from "path";

import { CommonOptions, nodePaths } from "./index.js";

export interface BuilderOptions {
  watch?: boolean;
}

export let main = async (opts: BuilderOptions & CommonOptions) => {
  let build = cli({ watch: opts.watch, debug: opts.watch });
  let { dir, name } = path.parse(opts.file);
  let target = path.join(dir, name + ".html");
  log.info("Starting build...");
  await build({
    entryPoints: [target],
    outfile: "dist/index.mjs",
    nodePaths,
    plugins: [notaPlugin({}), ssrPlugin(), ...(opts.config.plugins || [])],
  });

  if (fs.existsSync("static")) {
    await fs.copy("static", "dist/static");
  }
};
