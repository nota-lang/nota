import { cli, file_exists, log } from "@nota-lang/esbuild-utils";
import { err, ok } from "@nota-lang/nota-common";
import { peerDependencies } from "@nota-lang/nota-components/dist/peer-dependencies.mjs";
import type {
  TranslationResult,
  /*, Message*/
} from "@nota-lang/nota-editor";
import { nota_plugin } from "@nota-lang/nota-syntax/dist/esbuild-plugin";
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
  let input_path = path.resolve(opts.file);
  if (!(await file_exists(input_path))) {
    await fs.writeFile(input_path, "");
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

  let socket_cbs: (() => void)[] = [];
  let output: TranslationResult | null = null;
  let load_output = async () => {
    let [lowered, map_json, css] = await Promise.all(
      [OUTPUT_JS_PATH, OUTPUT_MAP_PATH, OUTPUT_CSS_PATH].map(async p =>
        (await file_exists(p)) ? fs.readFile(p, "utf-8") : null
      )
    );
    let map = JSON.parse(map_json!);
    let idx = _.findIndex(
      map.sources,
      (p: string) => path.basename(p) == path.basename(input_path)
    );
    let transpiled = map.sourcesContent[idx];
    output = ok({
      lowered: lowered!,
      transpiled,
      css,
    });
  };

  let watch: esbuild.WatchMode = {
    async onRebuild(error, _result) {
      if (error) {
        output = err(error.errors.map(err => err.text).join("\n"));
      } else {
        await load_output();
      }
      socket_cbs.forEach(cb => cb());
    },
  };

  let build = cli({
    watch,
    debug: true,
  });
  await build({
    entryPoints: [input_path],
    outfile: OUTPUT_JS_PATH,
    globalName: "nota_document",
    external: peerDependencies,
    format: "iife",
    nodePaths,
    plugins: [nota_plugin({ pretty: true }), ...(opts.config.plugins || [])],
  });

  app.ws("/", async (ws, _req) => {
    await load_output();
    let contents = await fs.readFile(input_path, "utf-8");
    ws.send(
      JSON.stringify({
        type: "InitialContent",
        contents,
        translation: output,
      })
    );

    ws.on("message", async data => {
      let msg /*: Message*/ = JSON.parse(data.toString("utf-8"));
      if (msg.type == "SyncText") {
        await fs.writeFile(input_path, msg.contents);
      } else {
        throw `Invalid request ${msg}`;
      }
    });

    socket_cbs.push(() => {
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
    let in_use = await tcpPortUsed.check(port, "localhost");
    if (!in_use) {
      break;
    }
    port++;
  }

  log.info(`Starting a server at: http://localhost:${port}`);
  app.listen(port);

  open(`http://localhost:${port}`);
};
