import express from "express";
import expressWs from "express-ws";
import path from "path";
import { constants, promises as fs } from "fs";
import * as esbuild from "esbuild";
import { ok, err } from "@nota-lang/nota-common";
import { nota_plugin } from "@nota-lang/nota-syntax/dist/esbuild-plugin";
import { peerDependencies } from "@nota-lang/nota-components/dist/peer-dependencies";
import _ from "lodash";
import type { TranslationResult /*, Message*/ } from "@nota-lang/nota-editor";

export interface ServerOptions {
  file: string;
  extensions?: string[];
  port?: number;
}

export let main = async (opts: ServerOptions) => {
  let input_path = path.resolve(opts.file);
  try {
    await fs.access(input_path, constants.F_OK);
  } catch (e) {
    await fs.writeFile(input_path, "");
  }

  let { app } = expressWs(express());

  app.use(express.static(__dirname));
  app.use(express.static("dist"));

  let loader: { [_k: string]: esbuild.Loader } = opts.extensions
    ? _.fromPairs(opts.extensions.map((k: string) => ["." + k, "text"]))
    : {};

  const OUTPUT_PATH = "dist/document.js";
  const OUTPUT_MAP_PATH = OUTPUT_PATH + ".map";

  let socket_cbs: (() => void)[] = [];
  let output: TranslationResult | null = null;
  let load_output = async () => {
    let [lowered, map] = await Promise.all(
      [OUTPUT_PATH, OUTPUT_MAP_PATH].map(p => fs.readFile(p, "utf-8"))
    );
    let transpiled = JSON.parse(map).sourcesContent[0];
    output = ok({
      lowered,
      transpiled,
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

  let initial_build = esbuild.build({
    entryPoints: [input_path],
    bundle: true,
    sourcemap: true,
    outfile: OUTPUT_PATH,
    plugins: [nota_plugin({ pretty: true })],
    globalName: "nota_document",
    external: peerDependencies,
    watch,
    loader,
  });

  app.ws("/", async (ws, _req) => {
    await initial_build;
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
  app.listen(port);
};
