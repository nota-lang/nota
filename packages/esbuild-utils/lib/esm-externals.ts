import { Plugin } from "esbuild";
import _ from "lodash";

export interface EsmExternalsPluginOptions {
  externals: string[];
}

let ALLOWLIST = ["react"];

export let esmExternalsPlugin = ({ externals }: EsmExternalsPluginOptions): Plugin => ({
  name: "esm-externals",
  setup(build) {
    externals = externals.filter(m => ALLOWLIST.includes(m));
    let filter = new RegExp("^(" + externals.map(_.escapeRegExp).join("|") + ")(\\/.*)?$");

    let namespace = "esm-externals";
    build.onResolve({ filter: /.*/, namespace }, args => ({
      path: args.path,
      external: true,
    }));

    build.onResolve({ filter }, args => ({
      path: args.path,
      namespace,
    }));

    build.onLoad({ filter: /.*/, namespace }, args => ({
      contents: `export * as default from "${args.path}"; export * from "${args.path}";`,
    }));
  },
});
