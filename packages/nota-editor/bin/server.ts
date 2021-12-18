#!/usr/bin/env -S node -r @cspotcode/source-map-support/register

import express from "express";
import expressWs from "express-ws";
import path from "path";
import { constants, promises as fs } from "fs";
import esbuild from "esbuild";
import { program } from "commander";
import { Result, ok, err } from "@wcrichto/nota-common";
import { nota_plugin } from "@wcrichto/nota-syntax/dist/esbuild-plugin";
import peerDependencies from "@wcrichto/nota-components/dist/peer-dependencies";
import _ from "lodash";
import type { TranslationResult, Message }  from "../lib/state";


let main = async () => {
  program
    .version("0.1.0")
    .option("-e, --extensions <exts>")
    .option("--open")
    .option("-p, --port <port>")
    .argument("<input>");
  program.parse(process.argv);
  let opts = program.opts();
  let input_path = path.resolve(program.args[0]);
  try {
    await fs.access(input_path, constants.F_OK);
  } catch (e) {
    await fs.writeFile(input_path, "");
  }

  let { app } = expressWs(express());

  let SERVER_ROOT = path.resolve(path.join(__dirname, "..", "frontend"));
  app.use(express.static(SERVER_ROOT));
  app.use(express.static("dist"));

  let loader: { [_k: string]: esbuild.Loader } = opts.extensions
    ? _.fromPairs(opts.extensions.split(",").map((k: string) => ["." + k, "text"]))
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
    async onRebuild(error, result) {
      if (error) {
        output = err(Error(error.errors.map(err => err.text).join("\n")));
      } else {
        await load_output();
      }
      socket_cbs.forEach(cb => cb());
    },
  };

  let initial_build = esbuild
    .build({
      entryPoints: [input_path],
      bundle: true,
      sourcemap: true,
      outfile: OUTPUT_PATH,
      plugins: [nota_plugin({ pretty: true })],
      globalName: "nota_document",
      external: peerDependencies,
      watch,
      loader,
    })
    .catch(_ => {});

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
      let msg: Message = JSON.parse(data.toString("utf-8"));
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

  let port = opts.port ? parseInt(opts.port) : 8000;
  app.listen(port);
};

main();
