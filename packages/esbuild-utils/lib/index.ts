import "@cspotcode/source-map-support/register.js";
import * as cp from "child_process";
import { program } from "commander";
import commonPathPrefix from "common-path-prefix";
//@ts-ignore
import esMain from "es-main";
import esbuild, { BuildOptions, BuildResult, Loader, Plugin, WatchMode } from "esbuild";
import fs from "fs";
import { promise as glob } from "glob-promise";
import http from "http";
import _ from "lodash";
import statik from "node-static";
import type { IDependencyMap, IPackageJson } from "package-json-type";
import path from "path";
import puppeteer from "puppeteer-core";
import tcpPortUsed from "tcp-port-used";
import winston from "winston";

export let fileExists = async (path: string): Promise<boolean> => {
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
  ts?: boolean;
}

export let isMain = esMain;

export let getManifest = (): IPackageJson => {
  let pkgPath = "./package.json";
  return fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync("./package.json", "utf-8")) : {};
};

// Taken from https://github.com/chalk/ansi-regex
const ANSI_REGEX = new RegExp(
  [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
  ].join("|"),
  "g"
);

export let tscPlugin = (): Plugin => ({
  name: "tsc",
  setup(build) {
    let opts = ["-emitDeclarationOnly"];
    if (build.initialOptions.watch) {
      opts.push("-w");
    }

    let tsc = cp.spawn("tsc", opts);
    tsc.stdout!.on("data", data => {
      console.log(data.toString().replace(ANSI_REGEX, "").trim());
    });
  },
});

export let cli = (
  externalOptions?: CliOptions
): ((_extra: BuildOptions) => Promise<[BuildResult, BuildOptions]>) => {
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
  let pkgExternal = keys(pkg.dependencies).concat(keys(pkg.peerDependencies));

  return async (extra: BuildOptions = {}) => {
    let plugins = extra.plugins || [];
    let format = extra.format || "esm";

    let external = (format != "iife" ? pkgExternal : []).concat(extra.external || []);

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

export let copyPlugin = ({ extensions }: { extensions: string[] }): Plugin => ({
  name: "copy",
  setup(build) {
    let outdir = build.initialOptions.outdir;
    if (!outdir) {
      throw `outdir must be specified`;
    }

    let paths: [string, string][] = [];
    let filter = new RegExp(extensions.map(_.escapeRegExp).join("|"));
    build.onResolve({ filter }, async args => {
      let absPath = path.join(args.resolveDir, args.path);
      let matchingPaths = await glob(absPath);
      paths = paths.concat(matchingPaths.map(p => [p, path.join(outdir!, path.basename(p))]));
      return { path: args.path, namespace: "copy" };
    });

    build.onLoad({ filter: /.*/, namespace: "copy" }, async _args => ({ contents: "" }));
    build.onEnd(_ => {
      paths.forEach(([inPath, outPath]) => fs.promises.copyFile(inPath, outPath));
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

  // How long the page waits to determine that a Nota document has finished rendering,
  // i.e. when there are no MutationObserver events
  inPageRenderTimeout?: number;

  // How long Puppeteer waits from the start of rendering for the document to finish rendering.
  externalRenderTimeout?: number;

  // Port for the static file server
  port?: number;
}

export let ssrPlugin = (opts?: SsrOptions): Plugin => ({
  name: "ssr",
  async setup(build) {
    let watch = build.initialOptions.watch;

    build.initialOptions.outExtension = {
      ...(build.initialOptions.outExtension || {}),
      ".js": ".mjs",
    };

    build.onResolve({ filter: /\.html$/ }, args => ({
      path: args.path,
      namespace: "ssr",
    }));

    let getPathParts = (p: string): { name: string; dir: string } => {
      let { name, dir } = path.parse(p);
      let outfile = build.initialOptions.outfile;
      name = outfile ? path.parse(outfile).name : name;
      return { name, dir };
    };

    let SSR_CLASS = "ssr-env";
    let NOTA_READY = "window.NOTA_READY";

    build.onLoad({ filter: /./, namespace: "ssr" }, args => {
      let p = path.resolve(args.path);
      let { name, dir } = getPathParts(p);
      let script = `./${name}.mjs`;
      let templatePath = "@nota-lang/esbuild-utils/dist/template";
      if (opts && opts.template) {
        templatePath = "." + path.sep + path.relative(dir, opts.template);
      }

      let render_timeout = (opts && opts.inPageRenderTimeout) || 1000;

      // TODO 1: there should be some kind of indicator while the shadow page is rendering
      // TODO 2: it would be ideal if Nota committed to having plugins say when they're done,
      //   so we don't need to watch mutations
      let contents = `
      import React from "react";
      import ReactDOM from "react-dom";
      import Doc, * as doc_mod from "./${path.parse(p).name}.nota"
      import Template from "${templatePath}";

      let key = "metadata";
      let metadata = key in doc_mod ? doc_mod[key] : {};
      let Page = (props) => <Template {...props}><Doc /></Template>;

      let wait_to_render = async (element) => {
        let last_change = Date.now();
        let observer = new MutationObserver(evt => { last_change = Date.now(); });
        observer.observe(element, {subtree: true, childList: true, attributes: true});
        
        return new Promise(resolve => {
          let intvl = setInterval(() => {
            if (Date.now() - last_change > ${render_timeout}) {
              clearInterval(intvl);
              observer.disconnect();
              resolve();
            }
          }, 50);
        });  
      };  

      let main = async () => {
        let html = document.documentElement;
        if (html.classList.contains("${SSR_CLASS}")) {
          html.classList.remove("${SSR_CLASS}");      
          ReactDOM.render(<Page {...metadata} script={"${script}"} />, html);
          await wait_to_render(html);
          ${NOTA_READY} = true;  
        } else {
          let root = document.getElementById('root');
          let new_root = document.createElement('div');
          ReactDOM.render(<Doc />, new_root);                            
          await wait_to_render(new_root);
          root.parentNode.replaceChild(new_root, root);
        }
      };                 

      main();
      `;

      return { contents, loader: "jsx", resolveDir: dir };
    });

    let port = (opts && opts.port) || 8000;
    const MAX_TRIES = 10;
    for (let i = 0; i < MAX_TRIES; i++) {
      let in_use = await tcpPortUsed.check(port, "localhost");
      if (!in_use) {
        break;
      }
      port++;
    }
    let browser = await puppeteer.launch({ channel: "chrome" });
    let fileServer = new statik.Server("./dist", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
    let httpServer = http
      .createServer((request, response) =>
        request.addListener("end", () => fileServer.serve(request, response)).resume()
      )
      .listen(port);

    build.onEnd(async _args => {
      let entryPoints = build.initialOptions.entryPoints as string[];
      let common_prefix = commonPathPrefix(entryPoints);

      let promises = entryPoints.map(async p => {
        let { name, dir } = getPathParts(path.relative(common_prefix, p));

        let page = await browser.newPage();

        // Pipe in-page logging to the terminal for debugging purposes
        page
          .on("console", message => log.info(message.text()))
          .on("pageerror", err => log.error(err.toString()))
          .on("error", err => log.error(err.toString()));

        // Put the HTML into the page and wait for initial load
        let html = `<!DOCTYPE html>
        <html lang="en" class="${SSR_CLASS}">
          <body><script src="http://localhost:${port}/${dir}/${name}.mjs" type="module"></script></body>
        </html>`;
        await page.setContent(html, { waitUntil: "domcontentloaded" });

        // Then wait for NOTA_READY to be set by the SSR script
        let timeout = (opts && opts.externalRenderTimeout) || 10000;
        await page.waitForFunction(NOTA_READY, { timeout });

        // And write the rendered HTML to disk once it's ready
        let content = await page.content();
        let htmlPath = path.join("dist", dir, name + ".html");
        await fs.promises.writeFile(htmlPath, content);
      });

      await Promise.all(promises);

      if (!watch) {
        httpServer.close();
        await browser.close();
      }
    });
  },
});

export let executablePlugin = (paths: string[]): Plugin => ({
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
