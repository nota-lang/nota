import c from "ansi-colors";
import commonPathPrefix from "common-path-prefix";
import { Plugin } from "esbuild";
import fs from "fs";
import http from "http";
import _ from "lodash";
import statik from "node-static";
import path from "path";
import puppeteer from "puppeteer";
import tcpPortUsed from "tcp-port-used";

import { log } from "./log.js";

export interface SsrPluginOptions {
  /** A JS import path of a file that exports a React template used for the entire page body.
   * Defaults to @nota-lang/esbuild-utils/dist/template. */
  template?: string;

  /** How long the page waits to determine that a Nota document has finished rendering,
   * i.e. when there are no MutationObserver events */
  inPageRenderTimeout?: number;

  /** How long Puppeteer waits from the start of rendering for the document to finish rendering. */
  externalRenderTimeout?: number;

  /** Port for the static file server */
  port?: number;

  /** Language for the webpage */
  language?: string;

  /** Automatically delete all files in dist/ directory that aren't used by Puppeteer */
  removeUnusedFiles?: boolean;
}

class FileServer {
  constructor(private httpServer: http.Server, readonly port: number) {}

  static async start(opts: SsrPluginOptions): Promise<FileServer> {
    let fileServer = new statik.Server("./dist", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });

    let port = opts.port || 8000;
    const MAX_TRIES = 10;
    for (let i = 0; i < MAX_TRIES; i++) {
      let in_use = await tcpPortUsed.check(port, "localhost");
      if (!in_use) break;
      port++;
    }

    let httpServer = http
      .createServer((request, response) =>
        request.addListener("end", () => fileServer.serve(request, response)).resume()
      )
      .listen(port);
    return new FileServer(httpServer, port);
  }

  dispose() {
    this.httpServer.close();
  }
}

/** Esbuild plugin for server-side rendering with Nota documents.
 *
 * To use this plugin, your esbuild entryPoints should be .nota documents.
 * Then an HTML file and JS bundle will be generated for each document
 * with a pre-rendered version of the document.
 *
 * Note that we use Puppeteer and NOT ReactDomServer for SSR in order to
 * allow things like document links to resolve before being saved to the output. */
export let ssrPlugin = (opts: SsrPluginOptions = {}): Plugin => ({
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
    let NOTA_OUTPUT = "window.NOTA_OUTPUT";

    build.onLoad({ filter: /./, namespace: "ssr" }, args => {
      let p = path.resolve(args.path);
      let { name, dir } = getPathParts(p);
      let script = `./${name}.mjs`;
      let notaPath = `./${path.parse(p).name}.nota`;
      let templatePath = "@nota-lang/esbuild-utils/dist/template.js";
      if (opts.template) {
        templatePath = "." + path.sep + path.relative(dir, opts.template);
      }

      let renderTimeout = opts.inPageRenderTimeout || 1000;

      // TODO 1: there should be some kind of indicator while the shadow page is rendering
      // TODO 2: this is a lot of code to exist as a string. can we factor it into a module?
      let contents = `
      import React from "react";
      import * as ReactDOM from "react-dom/client";
      import Doc, * as docMod from "${notaPath}";
      import Template from "${templatePath}";

      let key = "metadata";
      let metadata = key in docMod ? docMod[key] : {};
      let Page = ({onRender, ...props}) => <Template {...props}>
        <div id="root">
          <Doc onRender={onRender} renderTimeout={${renderTimeout}} />
        </div>
      </Template>;

      let html = document.documentElement;
      if (html.classList.contains("${SSR_CLASS}")) {
        html.classList.remove("${SSR_CLASS}");
        let root = ReactDOM.createRoot(html);
        root.render(<Page {...metadata} script={"${script}"} onRender={defs => {
          ${NOTA_OUTPUT} = defs;
        }} />);
      } else {
        let rootEl = document.getElementById("root");
        let newRootEl = document.createElement('div');
        newRootEl.style.position = 'absolute';
        newRootEl.style.left = '-999999px';
        let root = ReactDOM.createRoot(newRootEl);
        rootEl.parentNode.appendChild(newRootEl);
        root.render(<Doc onRender={() => {
          newRootEl.style.position = 'relative';
          newRootEl.style.left = '0';
          rootEl.parentNode.replaceChild(newRootEl, rootEl);
        }} />);
      }
      `;

      return { contents, loader: "jsx", resolveDir: dir };
    });

    let browserPromise = puppeteer.launch();
    let fileServerPromise = FileServer.start(opts);

    // TODO: make this incremental when watching many endpoints, right now they all get recompiled
    // on every change
    build.onEnd(async _args => {
      log.info("Waiting for browser (may take ~15s the first build)...");
      let [browser, fileServer] = await Promise.all([browserPromise, fileServerPromise]);

      let entryPoints = build.initialOptions.entryPoints as string[];
      let commonPrefix =
        entryPoints.length == 1 ? path.dirname(entryPoints[0]) : commonPathPrefix(entryPoints);

      let requestedFiles = new Set();
      let promises = entryPoints.map(async p => {
        let { name, dir } = getPathParts(path.relative(commonPrefix, p));

        let htmlPath = path.join("dist", dir, name + ".html");

        log.info(`Rendering page: ${path.parse(p).name} -> ${htmlPath}`);
        let page = await browser.newPage();
        await page.setViewport({ width: 1720, height: 720 });

        // Pipe in-page logging to the terminal for debugging purposes
        let logPrefix = c.italic(`(${dir}/${name})`);
        page
          .on("console", message => {
            let text = message.text();
            if (text.includes("Download the React DevTools")) return;
            log.info(logPrefix + " " + text);
          })
          .on("pageerror", err => {
            if (build.initialOptions.minify) {
              log.info("Note: for better stack traces, try building with -g");
            }
            log.error(logPrefix + err.toString());
          })
          .on("error", err => {
            log.error(logPrefix + err.toString());
          });

        // Put the HTML into the page and wait for initial load
        let url = `http://localhost:${fileServer.port}/${dir}/`;
        let html = `<!DOCTYPE html>
        <html lang="${opts.language || "en"}" class="${SSR_CLASS}">
          <body><script src="${url}${name}.mjs" type="module" async></script></body>
        </html>`;
        await page.setRequestInterception(true);
        page.on("request", req => {
          let reqUrl = req.url();
          let prefix = `http://localhost:${fileServer.port}//`;
          if (reqUrl.startsWith(prefix)) {
            requestedFiles.add(reqUrl.slice(prefix.length));
          }

          if (reqUrl == url) {
            req.respond({
              body: html,
              contentType: "text/html",
            });
          } else {
            req.continue();
          }
        });
        await page.goto(url, { waitUntil: "domcontentloaded" });

        // Then wait for NOTA_OUTPUT to be set by the SSR script
        let timeout = opts.externalRenderTimeout || 10000;
        let notaOutputHandle;
        try {
          notaOutputHandle = await page.waitForFunction(NOTA_OUTPUT, { timeout });
        } catch (e) {
          // TODO: this is incredibly verbose when piped through esbuild...
          // can we make it better?
          throw new Error(`${dir}/${name} failed to build`);
        }
        // let notaOutput = await notaOutputHandle.jsonValue();
        await page.waitForNetworkIdle({ timeout });

        // await page.screenshot({ path: `./${name}.jpg` });

        // And write the rendered HTML to disk once it's ready
        let content = await page.content();
        await Promise.all([fs.promises.writeFile(htmlPath, content), page.close()]);
      });

      await Promise.all(promises);

      if (!watch) {
        fileServer.dispose();
        await browser.close();

        if (opts.removeUnusedFiles) {
          log.info("Cleaning up unused files...");
          let files = await fs.promises.readdir("dist");
          await Promise.all(
            files.map(async f => {
              let full = path.join("dist", f);
              let stat = await fs.promises.stat(full);
              if (stat.isFile() && !requestedFiles.has(f) && !f.endsWith(".html")) {
                await fs.promises.rm(full);
              }
            })
          );
        }
      }
    });
  },
});
