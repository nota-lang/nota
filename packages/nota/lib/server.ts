import { cli, fileExists, getManifest, log } from "@nota-lang/esbuild-utils";
import { err, ok } from "@nota-lang/nota-common/dist/result.js";
import { peerDependencies } from "@nota-lang/nota-components/dist/peer-dependencies.mjs";
import type {
  TranslationResult,
  /*, Message*/
} from "@nota-lang/nota-editor";
import { GLOBAL_NAME } from "@nota-lang/nota-editor/dist/dynamic-load.js";
import { notaPlugin } from "@nota-lang/nota-syntax/dist/esbuild-plugin.js";
import * as esbuild from "esbuild";
import express from "express";
import expressWs from "express-ws";
import { promises as fs } from "fs";
import _ from "lodash";
import open from "open";
import os from "os";
import path from "path";
import tcpPortUsed from "tcp-port-used";

import { CommonOptions, __dirname, nodePaths } from "./index";

export interface ServerOptions {
  extensions?: string[];
  port?: number;
  static?: string;
}

export let main = async (opts: ServerOptions & CommonOptions) => {
  let manifest = getManifest();

  let inputPath = path.resolve(opts.file);
  if (!(await fileExists(inputPath))) {
    await fs.writeFile(inputPath, "");
  }

  let { app } = expressWs(express());

  const outdir = await fs.mkdtemp(path.join(os.tmpdir(), path.sep, "nota-"));

  // TODO: figure out how to cleanup the outdir.
  //  Issue is that esbuild is also catching a SIGINT
  // let rm = async () => {
  //   await fs.rm(outdir, {recursive: true})
  // };
  // process.on('SIGTERM', rm);
  // process.on('SIGINT', rm);

  app.use(express.static(__dirname));
  app.use(express.static(outdir));
  if (opts.static) {
    app.use(express.static(opts.static));
  }

  const OUTPUT_JS_PATH = path.join(outdir, "document.js");
  const OUTPUT_MAP_PATH = OUTPUT_JS_PATH + ".map";
  const OUTPUT_CSS_PATH = path.join(outdir, "document.css");

  let socketCbs: (() => void)[] = [];
  let output: TranslationResult | null = null;
  let loadOutput = async () => {
    let [lowered, map, css] = await Promise.all(
      [OUTPUT_JS_PATH, OUTPUT_MAP_PATH, OUTPUT_CSS_PATH].map(async p =>
        (await fileExists(p)) ? fs.readFile(p, "utf-8") : null
      )
    );
    let mapJson = JSON.parse(map!);
    let idx = _.findIndex(
      mapJson.sources,
      (p: string) => path.basename(p) == path.basename(inputPath)
    );
    let transpiled = mapJson.sourcesContent[idx];
    output = ok({
      lowered: lowered!,
      transpiled,
      css,
      map: map!,
    });
  };

  let watch: esbuild.WatchMode = {
    async onRebuild(error, _result) {
      if (error) {
        output = err(error.errors.map(err => err.text).join("\n"));
      } else {
        await loadOutput();
      }
      socketCbs.forEach(cb => cb());
    },
  };

  let build = cli({
    watch,
    debug: true,
  });
  await build({
    entryPoints: [inputPath],
    outfile: OUTPUT_JS_PATH,
    globalName: GLOBAL_NAME,
    external: peerDependencies,
    format: "iife",
    nodePaths,
    plugins: [notaPlugin({ pretty: true }), ...(opts.config.plugins || [])],
  });

  app.ws("/", async (ws, _req) => {
    await loadOutput();
    let contents = await fs.readFile(inputPath, "utf-8");

    let allPackages = Object.keys(manifest.dependencies || {}).concat(
      Object.keys(manifest.devDependencies || {})
    );
    let availableLanguages = _.fromPairs(
      await Promise.all(
        allPackages
          .filter(pkg => pkg.startsWith("@codemirror/lang-"))
          .map(async pkg => {
            let name = pkg.slice("@codemirror/lang-".length);

            let {
              outputFiles: [output],
            } = await esbuild.build({
              stdin: {
                contents: `export {${name}} from "${pkg}"`,
                resolveDir: process.cwd(),
              },
              globalName: GLOBAL_NAME,
              external: peerDependencies,
              bundle: true,
              write: false,
            });

            return [name, output.text];
          })
      )
    );

    ws.send(
      JSON.stringify({
        type: "InitialContent",
        contents,
        translation: output,
        availableLanguages,
      })
    );

    ws.on("message", async data => {
      let msg /*: Message*/ = JSON.parse(data.toString("utf-8"));
      if (msg.type == "SyncText") {
        await fs.writeFile(inputPath, msg.contents);
      } else {
        throw `Invalid request ${msg}`;
      }
    });

    socketCbs.push(() => {
      ws.send(
        JSON.stringify({
          type: "NewOutput",
          translation: output!,
        })
      );
    });
  });

  let port = opts.port ? opts.port : 8000;
  const MAX_TRIES = 10;
  for (let i = 0; i < MAX_TRIES; i++) {
    let inUse = await tcpPortUsed.check(port, "localhost");
    if (!inUse) {
      break;
    }
    port++;
  }

  log.info(`Starting a server at: http://localhost:${port}`);
  app.listen(port);

  open(`http://localhost:${port}`);
};
