import fs from "fs";
import esbuild, { BuildOptions, BuildResult, Plugin, Loader, WatchMode } from "esbuild";
import type { IPackageJson, IDependencyMap } from "package-json-type";
import path from "path";
import _ from "lodash";
import { promise as glob } from "glob-promise";
import winston from "winston";
import { program } from "commander";
//@ts-ignore
import esMain from "es-main";
import "@cspotcode/source-map-support/register.js";

export let file_exists = async (path: string): Promise<boolean> => {
  try {
    await fs.promises.access(path, fs.constants.F_OK);
    return true;
  } catch (_e) {
    return false;
  }
};

export let log = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message }) => {
          let timestamp = new Date().toLocaleTimeString();
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    }),
  ],
});

export interface CliOptions {
  watch?: boolean | WatchMode;
  debug?: boolean;
}

export let is_main = esMain;

export let cli = (
  external_options?: CliOptions
): ((_extra: BuildOptions) => Promise<[BuildResult, BuildOptions]>) => {
  let options =
    external_options ||
    (program
      .option("-w, --watch", "Watch for changes and rebuild")
      .option("-g, --debug", "Do not minify and include source maps")
      .parse(process.argv)
      .opts() as CliOptions);

  let pkg_path = "./package.json";
  let pkg: IPackageJson = fs.existsSync(pkg_path)
    ? JSON.parse(fs.readFileSync("./package.json", "utf-8"))
    : {};
  let keys = (map?: IDependencyMap) => Object.keys(map || {});
  let pkg_external = keys(pkg.dependencies).concat(keys(pkg.peerDependencies));

  return async (extra: BuildOptions) => {
    let external = pkg_external.concat(extra.external || []);
    let plugins = extra.plugins || [];
    let format = extra.format || "esm";
    if (format == "esm") {
      plugins.push(esm_externals_plugin({ externals: external }));
    }

    let loader: { [ext: string]: Loader } = {
      ".otf": "file",
      ".woff": "file",
      ".woff2": "file",
      ".ttf": "file",
      ".wasm": "file",
      ".bib": "text",
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

    let opts = {
      ...extra,
      ...outpaths,
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

export let copy_plugin = ({ extensions }: { extensions: string[] }): Plugin => ({
  name: "copy",
  setup(build) {
    let outdir = build.initialOptions.outdir;
    if (!outdir) {
      throw `outdir must be specified`;
    }

    let paths: [string, string][] = [];
    let filter = new RegExp(extensions.map(_.escapeRegExp).join("|"));
    build.onResolve({ filter }, async args => {
      let abs_path = path.join(args.resolveDir, args.path);
      let matching_paths = await glob(abs_path);
      paths = paths.concat(matching_paths.map(p => [p, path.join(outdir!, path.basename(p))]));
      return { path: args.path, namespace: "copy" };
    });

    build.onLoad({ filter: /.*/, namespace: "copy" }, async _args => ({ contents: "" }));
    build.onEnd(_ => {
      paths.forEach(([inpath, outpath]) => fs.promises.copyFile(inpath, outpath));
    });
  },
});

let ALLOWLIST = ["react"];
export let esm_externals_plugin = ({ externals }: { externals: string[] }): Plugin => ({
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

export interface SsrOptions {
  template?: string;
}

export let ssr_plugin = (opts?: SsrOptions): Plugin => ({
  name: "ssr",
  setup(build) {
    build.onResolve({ filter: /\.html$/ }, args => ({
      path: args.path,
      namespace: "ssr",
    }));

    build.onLoad({ filter: /./, namespace: "ssr" }, args => {
      let { name, dir } = path.parse(args.path);
      let script = `./${name}.mjs`;
      let template_path = "@nota-lang/esbuild-utils/dist/template";
      if (opts && opts.template) {
        template_path = "." + path.sep + path.relative(dir, opts.template);
      }
      
      let contents = `
      import React from "react";
      import ReactDOM from "react-dom";
      import Doc, {metadata} from "./${name}.nota"
      import Template from "${template_path}";
      import { canUseDOM } from "exenv";

      export let Page = (props) => <Template {...props}><Doc /></Template>;
      export { metadata };
      export { default as React } from "react";
      export { default as ReactDOMServer } from "react-dom/server";
      
      if (canUseDOM) {
        ReactDOM.hydrate(<Page {...metadata} script={"${script}"} />, document.documentElement);
      }
      `;

      return { contents, loader: "jsx", resolveDir: dir };
    });

    build.onEnd(async _args => {
      let entryPoints = build.initialOptions.entryPoints;
      let promises = (entryPoints as string[]).map(async p => {
        let { name, dir } = path.parse(path.relative("src", p));
        let script = `./${name}.mjs`;

        let mod = await import(path.resolve(path.join("dist", dir, name + ".mjs")));
        let { Page, React, ReactDOMServer, metadata } = mod;

        // IMPORTANT NOTE: if *any* timers / intervals are still running after the page is rendered,
        // this will cause NodeJS to hang! Timers should either be feature-gated (canUseDOM) or effect-gated (useEffect)
        let content = ReactDOMServer.renderToString(
          React.createElement(Page, { script, ...metadata })
        );

        await fs.promises.writeFile(
          path.join("dist", dir, name + ".html"),
          `<!DOCTYPE html><html lang="en">${content}</html>`
        );
      });

      await Promise.all(promises);
    });
  },
});
