import { Plugin } from "esbuild";
import _ from "lodash";
import { createRequire } from "module";

import { log } from "./log.js";

export interface PeerfixPluginOptions {
  modules: string[];
  meta: ImportMeta;
}

/**
 * Esbuild plugin that forces a module to always resolve to a single location.
 *
 * This fixes an issue when doing local development that involves a symlink
 * to a library that has peer dependencies. See:
 * https://penx.medium.com/managing-dependencies-in-a-node-package-so-that-they-are-compatible-with-npm-link-61befa5aaca7
 */
export let peerfixPlugin = ({ modules, meta }: PeerfixPluginOptions): Plugin => ({
  name: "peerfix",
  setup(build) {
    let require = createRequire(meta.url);
    modules = modules.filter(m => !(build.initialOptions.external || []).includes(m));
    if (modules.length == 0) return;

    let filter = new RegExp(modules.map(k => `(^${_.escapeRegExp(k)}$)`).join("|"));
    build.onResolve({ filter }, args => {
      let resolved = require.resolve(args.path);
      log.debug(`Peerfix: resolving ${args.path} => ${resolved}`);
      return { path: resolved };
    });
  },
});
