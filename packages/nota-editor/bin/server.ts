#!/usr/bin/env node

import express from "express";
import expressWs from "express-ws";
import path from "path";
import fs from "fs/promises";
import esbuild from "esbuild";
import { program } from "commander";
import { Result, ok, err } from "@wcrichto/nota-common";
import { nota_plugin } from "@wcrichto/nota-syntax/dist/esbuild-plugin";
import _ from "lodash";

program.version("0.1.0").option("-e, --extensions <exts>").option("--open").argument("<input>");

program.parse(process.argv);
let opts = program.opts();
let input_path = path.resolve(program.args[0]);

let { app } = expressWs(express());

let SERVER_ROOT = path.resolve(path.join(__dirname, "..", "frontend"));
app.use(express.static(SERVER_ROOT));

let loader: { [_k: string]: esbuild.Loader } = opts.extensions
  ? _.fromPairs(opts.extensions.split(",").map((k: string) => ["." + k, "text"]))
  : {};

export type TranslationResult = Result<string, esbuild.BuildFailure>;

let socket_cbs = [];
let output: TranslationResult  | null = null;

const OUTPUT_PATH = "dist/document.js";
let watch = {
  async onRebuild(error, result) {
    if (error) {
      output = err(error);
    } else {
      output = ok((await fs.readFile(OUTPUT_PATH)).toString("utf-8"));
    }
    socket_cbs.forEach(cb => cb());
  },
};
let initial_build = esbuild.build({
  entryPoints: [input_path],
  bundle: true,
  sourcemap: true,
  outfile: OUTPUT_PATH,
  plugins: [nota_plugin()],
  globalName: "document",
  external: [
    "react",
    "react-dom",
    "mobx",
    "mobx-react",
    "@codemirror/basic-setup",
    "@wcrichto/nota",
  ],
  watch,
  loader,
});

export interface InitialContent {
  type: "InitialContent";
  contents: string;
  translation: TranslationResult;
}

export interface SyncText {
  type: "SyncText";
  contents: string;
}

export interface NewOutput {
  type: "NewOutput";
  translation: TranslationResult;
}

export type Message = SyncText | NewOutput | InitialContent;

app.ws("/", async (ws, _req) => {
  await initial_build;
  let contents = (await fs.readFile(input_path)).toString("utf-8");
  ws.send(
    JSON.stringify({
      type: "InitialContent",
      contents,
      translation: ok((await fs.readFile(OUTPUT_PATH)).toString("utf-8"))
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

app.listen(8000);
