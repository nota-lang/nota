import { cli, log, ssrPlugin } from "@nota-lang/esbuild-utils";
import { notaPlugin } from "@nota-lang/nota-syntax/dist/esbuild-plugin.js";
import fs from "fs-extra";
import path from "path";

import { CommonOptions, nodePaths } from "./index.js";

export interface BuilderOptions {
  watch?: boolean;
  debug?: boolean;
  port?: number;
}

export let main = async (opts: BuilderOptions & CommonOptions) => {
  let build = cli({ watch: opts.watch, debug: opts.watch || opts.debug });
  let { dir, name } = path.parse(opts.file);
  let target = path.join(dir, name + ".html");
  log.info("Starting build...");
  log.debug(`nodePaths: ${nodePaths}`);
  await build({
    entryPoints: [target],
    outfile: "dist/index.mjs",
    nodePaths,
    external: [],
    plugins: [
      notaPlugin({ extraCss: ["@nota-lang/nota-theme-standalone/dist/index.css"] }),
      ssrPlugin({ port: opts.port }),
      ...(opts.config.plugins || []),
    ],
  });

  if (fs.existsSync("static")) {
    await fs.copy("static", "dist/static");
  }
};
