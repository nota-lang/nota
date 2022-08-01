import { cli, log, peerfixPlugin, ssrPlugin } from "@nota-lang/esbuild-utils";
import { peerDependencies } from "@nota-lang/nota-components/dist/peer-dependencies.mjs";
import { notaPlugin } from "@nota-lang/nota-syntax/dist/esbuild-plugin.js";
import fs from "fs-extra";
import path from "path";
import process from "process";

import { CommonOptions, nodePaths } from "./index.js";

export interface BuilderOptions {
  watch?: boolean;
  debug?: boolean;
}

export let main = async (opts: BuilderOptions & CommonOptions) => {
  let build = cli({ watch: opts.watch, debug: opts.watch || opts.debug });
  let { dir, name } = path.parse(opts.file);
  let target = path.join(dir, name + ".html");
  log.info("Starting build...");
  await build({
    entryPoints: [target],
    outfile: "dist/index.mjs",
    nodePaths,
    plugins: [
      notaPlugin({ extraCss: ["@nota-lang/nota-theme-standalone/dist/index.css"] }),
      ssrPlugin(),
      peerfixPlugin({ modules: peerDependencies, meta: { url: process.cwd() } }),
      ...(opts.config.plugins || []),
    ],
  });

  if (fs.existsSync("static")) {
    await fs.copy("static", "dist/static");
  }
};
