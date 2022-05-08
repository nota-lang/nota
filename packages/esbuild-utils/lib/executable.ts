import { Plugin } from "esbuild";
import fs from "fs";

export interface ExecutablePluginOptions {
  paths: string[];
}

/** Runs `chmod +x` on the given {@link ExecutablePluginOptions.paths}. */
export let executablePlugin = ({ paths }: ExecutablePluginOptions): Plugin => ({
  name: "executable",
  setup(build) {
    build.initialOptions.banner = {
      js: `#!/usr/bin/env node`,
    };

    build.onEnd(async () => {
      await Promise.all(paths.map(p => fs.promises.chmod(p, fs.constants.S_IRWXU)));
    });
  },
});
