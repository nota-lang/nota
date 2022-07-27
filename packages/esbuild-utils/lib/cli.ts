import "@cspotcode/source-map-support/register.js";
import { program } from "commander";
import esbuild, { BuildOptions, BuildResult, Loader, WatchMode } from "esbuild";
import _ from "lodash";
import type { IDependencyMap } from "package-json-type";
import path from "path";

import { esmExternalsPlugin } from "./esm-externals.js";
import { fileExists, getManifest } from "./index.js";
import { log } from "./log.js";
import { tscPlugin } from "./tsc.js";

export interface CliOptions {
  watch?: boolean | WatchMode;
  debug?: boolean;
  ts?: boolean;
}

/** Simple CLI built atop esbuild. */
export let cli = (
  externalOptions?: CliOptions
): ((extra: BuildOptions) => Promise<[BuildResult, BuildOptions]>) => {
  let options =
    externalOptions ||
    (program
      .option("-w, --watch", "Watch for changes and rebuild")
      .option("-g, --debug", "Do not minify and include source maps")
      .option("-t, --typescript", "Run typescript")
      .parse(process.argv)
      .opts() as CliOptions);

  let pkg = getManifest();
  let keys = (map?: IDependencyMap) => Object.keys(map || {});
  let pkgExternal = keys(pkg.peerDependencies).concat(keys(pkg.dependencies));

  return async (extra: BuildOptions = {}) => {
    let plugins = extra.plugins || [];
    let format = extra.format || "esm";

    let external = format != "iife" ? extra.external || pkgExternal : [];

    if (format == "esm") {
      plugins.push(esmExternalsPlugin({ externals: external }));
    }

    let loader: { [ext: string]: Loader } = {
      ".otf": "file",
      ".woff": "file",
      ".woff2": "file",
      ".ttf": "file",
      ".wasm": "file",
      ".bib": "text",
      ".png": "file",
      ".jpg": "file",
      ".jpeg": "file",
      ".gif": "file",
      ...(extra.loader || {}),
    };

    let outpaths: BuildOptions = {};
    if (extra.outdir) {
      outpaths.outdir = extra.outdir;
    } else if (extra.outfile) {
      outpaths.outfile = extra.outfile;
    } else {
      extra.outdir = "dist";
    }

    let debug = options.debug || options.watch !== undefined;
    let watch: WatchMode | undefined =
      typeof options.watch === "object"
        ? options.watch
        : options.watch
        ? {
            onRebuild() {
              log.info("Rebuilt.");
            },
          }
        : undefined;

    let entryPoints = extra.entryPoints;
    if (!entryPoints) {
      entryPoints = [(await fileExists("./lib/index.ts")) ? "./lib/index.ts" : "./lib/index.tsx"];
    }

    if (options.ts || _.some(entryPoints, (p: string) => path.extname(p).startsWith(".ts"))) {
      plugins.push(tscPlugin());
    }

    let opts = {
      ...extra,
      ...outpaths,
      entryPoints,
      watch,
      external,
      plugins,
      format,
      loader,
      bundle: extra.bundle !== undefined ? extra.bundle : true,
      minify: extra.minify !== undefined ? extra.minify : !debug,
      sourcemap: extra.sourcemap !== undefined ? extra.sourcemap : debug,
    };

    let start = _.now();
    let result = await esbuild.build(opts);
    log.info(`Built in ${((_.now() - start) / 1000).toFixed(2)}s.`);
    return [result, opts];
  };
};
