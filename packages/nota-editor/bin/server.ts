#!/usr/bin/env node

import express from "express";
import expressWs from "express-ws";
import path from "path";
import fs from "fs/promises";
import {
  ImportRequest,
  ImportResponse,
  ContentsRequest,
  ContentsResponse,
  Request,
  Response,
  SyncRequest,
  SyncResponse,
  Result,
  ok,
  err,
} from "../lib/state";
import esbuild from "esbuild";
import { program } from "commander";
import _ from "lodash";

program.version("0.1.0").option("-e, --extensions <exts>").option("--open").argument("<input>");

program.parse(process.argv);
let opts = program.opts();
let input_path = path.resolve(program.args[0]);

let { app } = expressWs(express());

let SERVER_ROOT = path.resolve(path.join(__dirname, "..", "frontend"));
app.use(express.static(SERVER_ROOT));

let handle_contents = async (req: ContentsRequest): Promise<ContentsResponse> => {
  let contents = (await fs.readFile(input_path)).toString("utf-8");
  return {
    type: "Contents",
    contents,
  };
};

let handle_imports = async (req: ImportRequest): Promise<ImportResponse> => {
  let lines = req.paths.map((p, i) => `import * as _${i} from "${p}"; modules["${p}"] = _${i};`);
  let script = ["export let modules = {}"].concat(lines).join("\n");
  let plugin: esbuild.Plugin = {
    name: "input",
    setup(build) {
      build.onResolve({ filter: /input/ }, args => ({ path: args.path, namespace: "input" }));
      build.onLoad({ filter: /.*/, namespace: "input" }, _args => {
        return { contents: script, loader: "js", resolveDir: path.resolve(".") };
      });
    },
  };

  let loader: { [_k: string]: esbuild.Loader } = opts.extensions
    ? _.fromPairs(opts.extensions.split(",").map((k: string) => ["." + k, "text"]))
    : {};
  let imports;
  try {
    await esbuild.build({
      entryPoints: ["input"],
      bundle: true,
      sourcemap: true,
      format: "iife",
      globalName: "modules",
      outdir: "dist",
      plugins: [plugin],
      loader,
      external: [
        "react",
        "react-dom",
        "mobx",
        "mobx-react",
        "@codemirror/basic-setup",
        "@wcrichto/nota",
      ],
    });
    let bundle = (await fs.readFile("dist/input.js")).toString("utf-8");
    imports = ok(bundle);
  } catch (e: any) {
    imports = err(e.toString());
  }
  return { type: "Import", imports };
};

let handle_sync = async (req: SyncRequest): Promise<SyncResponse> => {
  let result: Result<null, string>;
  try {
    await fs.writeFile(input_path, req.contents);
    result = ok(null);
  } catch (e: any) {
    result = err(e.toString());
  }
  return {
    type: "Sync",
    result,
  };
};

app.ws("/", (ws, _req) => {
  ws.on("message", async data => {
    let req: Request = JSON.parse(data.toString("utf-8"));
    let resp: Response;
    if (req.type == "Contents") {
      resp = await handle_contents(req);
    } else if (req.type == "Import") {
      resp = await handle_imports(req);
    } else if (req.type == "Sync") {
      resp = await handle_sync(req);
    } else {
      throw `Invalid request ${req}`;
    }
    ws.send(JSON.stringify(resp));
  });
});

app.listen(8000);
