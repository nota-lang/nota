import commonPathPrefix from "common-path-prefix";
import { Plugin } from "esbuild";
import fs from "fs";
import http from "http";
import _ from "lodash";
import statik from "node-static";
import path from "path";
import puppeteer from "puppeteer-core";
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
      let templatePath = "@nota-lang/esbuild-utils/dist/template";
      if (opts.template) {
        templatePath = "." + path.sep + path.relative(dir, opts.template);
      }

      let render_timeout = opts.inPageRenderTimeout || 1000;

      // TODO 1: there should be some kind of indicator while the shadow page is rendering
      // TODO 2: it would be ideal if Nota committed to having plugins say when they're done,
      //   so we don't need to watch mutations
      // TODO 3: this is a lot of code to exist as a string. can we factor it into a module?
      let contents = `
      import React from "react";
      import ReactDOM from "react-dom";
      import Doc, * as doc_mod from "./${path.parse(p).name}.nota"
      import Template from "${templatePath}";

      let key = "metadata";
      let metadata = key in doc_mod ? doc_mod[key] : {};
      let Page = (props) => <Template {...props}><div id="root"><Doc /></div></Template>;

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
          let root = document.getElementById("root");
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

    let port = opts.port || 8000;
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
      let commonPrefix =
        entryPoints.length == 1 ? path.dirname(entryPoints[0]) : commonPathPrefix(entryPoints);

      let promises = entryPoints.map(async p => {
        let { name, dir } = getPathParts(path.relative(commonPrefix, p));

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
        let timeout = opts.externalRenderTimeout || 10000;
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
