import { Plugin } from "esbuild";
import fs from "fs";

export interface ExecutablePluginOptions {
  paths: string[];
}

/** Runs `chmod +x` on the given {@link ExecutablePluginOptions.paths}. */
export let executablePlugin = ({ paths }: ExecutablePluginOptions): Plugin => ({
  name: "executable",
  setup(build) {
    build.onEnd(async () => {
      await Promise.all(
        paths.map(async p => {
          // This originally used the `banner` option in esbuild, but apparently
          // the "use strict" invocation is always put before the banner when format = CJS,
          // so we have to manually write it ourselves.
          let f = await fs.promises.open(p, "r+");
          await f.chmod(fs.constants.S_IRWXU);
          let contents = await f.readFile("utf-8");
          await f.write(`#!/usr/bin/env node\n${contents}`, 0);
          await f.close();
        })
      );
    });
  },
});
