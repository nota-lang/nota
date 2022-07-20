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
}

class FileServer {
  constructor(private httpServer: http.Server, readonly port: number) {}

  static async start(opts: SsrPluginOptions): Promise<FileServer> {
    let port = opts.port || 8000;
    const MAX_TRIES = 10;
    for (let i = 0; i < MAX_TRIES; i++) {
      let in_use = await tcpPortUsed.check(port, "localhost");
      if (!in_use) break;
      port++;
    }
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
    let NOTA_READY = "window.NOTA_READY";

    build.onLoad({ filter: /./, namespace: "ssr" }, args => {
      let p = path.resolve(args.path);
      let { name, dir } = getPathParts(p);
      let script = `./${name}.mjs`;
      let templatePath = "@nota-lang/esbuild-utils/dist/template.js";
      if (opts.template) {
        templatePath = "." + path.sep + path.relative(dir, opts.template);
      }

      let renderTimeout = opts.inPageRenderTimeout || 1000;

      // TODO 1: there should be some kind of indicator while the shadow page is rendering
      // TODO 2: this is a lot of code to exist as a string. can we factor it into a module?
      let contents = `
      import React from "react";
      import ReactDOM from "react-dom";
      import Doc, * as doc_mod from "./${path.parse(p).name}.nota"
      import Template from "${templatePath}";

      let key = "metadata";
      let metadata = key in doc_mod ? doc_mod[key] : {};
      let Page = ({onRender, ...props}) => <Template {...props}>
        <div id="root">
          <Doc onRender={onRender} renderTimeout={${renderTimeout}} />
        </div>
      </Template>;

      let html = document.documentElement;
      if (html.classList.contains("${SSR_CLASS}")) {
        html.classList.remove("${SSR_CLASS}");      
        ReactDOM.render(<Page {...metadata} script={"${script}"} onRender={() => {
          ${NOTA_READY} = true; 
        }} />, html);         
      } else {
        let root = document.getElementById("root");
        let new_root = document.createElement('div');
        ReactDOM.render(<Doc onRender={() => {
          root.parentNode.replaceChild(new_root, root)
        }} />, new_root);                            
      }
      `;

      return { contents, loader: "jsx", resolveDir: dir };
    });

    let browserPromise = puppeteer.launch();
    let fileServerPromise = FileServer.start(opts);

    build.onEnd(async _args => {
      let [browser, fileServer] = await Promise.all([browserPromise, fileServerPromise]);

      let entryPoints = build.initialOptions.entryPoints as string[];
      let commonPrefix =
        entryPoints.length == 1 ? path.dirname(entryPoints[0]) : commonPathPrefix(entryPoints);

      let promises = entryPoints.map(async p => {
        let { name, dir } = getPathParts(path.relative(commonPrefix, p));
        let htmlPath = path.join("dist", dir, name + ".html");

        log.info(`Rendering page: ${path.parse(p).name} -> ${htmlPath}`);
        let page = await browser.newPage();

        // Pipe in-page logging to the terminal for debugging purposes
        page
          .on("console", message => log.info(c.italic("console.log:") + " " + message.text()))
          .on("pageerror", err => log.error(err.toString()))
          .on("error", err => log.error(err.toString()));

        // Put the HTML into the page and wait for initial load
        let scriptUrl = `http://localhost:${fileServer.port}/${dir}/${name}.mjs`;
        let html = `
<!DOCTYPE html>
<html lang="${opts.language || "en"}" class="${SSR_CLASS}">
  <body><script src="${scriptUrl}" type="module"></script></body>
</html>`;
        await page.setContent(html, { waitUntil: "domcontentloaded" });

        // Then wait for NOTA_READY to be set by the SSR script
        let timeout = opts.externalRenderTimeout || 10000;
        await page.waitForFunction(NOTA_READY, { timeout });

        // And write the rendered HTML to disk once it's ready
        let content = await page.content();
        await fs.promises.writeFile(htmlPath, content);
      });

      await Promise.all(promises);

      if (!watch) {
        fileServer.dispose();
        await browser.close();
      }
    });
  },
});
