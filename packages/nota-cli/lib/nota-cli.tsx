#!/usr/bin/env node

import React from "react";
import { program } from "commander";
import esbuild from "esbuild";
import path from "path";
import ReactDOMServer from "react-dom/server";
import { promises as fs } from "fs";
import mdx from "@mdx-js/esbuild";
// import { process_nota_markdown } from "@wcrichto/nota-markdown";
// import { VFile } from "vfile";

import { sassPlugin } from "esbuild-sass-plugin";

async function main() {
  program.version("0.1.0").argument("<input>");

  program.parse(process.argv);
  let _opts = program.opts();

  let input_path = path.resolve(program.args[0]);
  let outfile = path.resolve("dist/index.js");
  await esbuild.build({
    entryPoints: [input_path],
    outfile,
    bundle: true,
    plugins: [mdx()],
    format: "cjs",
    external: ["react", "react-dom"],
    sourcemap: true,
    loader: {
      ".otf": "file",
      ".woff": "file",
      ".woff2": "file",
      ".ttf": "file",
      ".bib": "file"
    },
  });

  let loader_path = path.resolve(path.join(__dirname, "page-loader.tsx"));
  let injected_document_plugin = {
    name: "injected_document_plugin",
    setup(build) {
      build.onResolve({ filter: /injected-document/ }, args => ({
        path: path.resolve(path.join("dist", "index.js")),
      }));
    },
  };
  await esbuild.build({
    entryPoints: [loader_path],
    outdir: "dist",
    bundle: true,
    format: "iife",
    plugins: [injected_document_plugin, sassPlugin() as any],
  });

  let {
    default: { default: Document },
  } = await import(outfile);
  let doc_html = ReactDOMServer.renderToString(<Document />);

  let index_html = `
<html>
  <head>
    <link href="index.css" rel="stylesheet" />
    <link href="page-loader.css" rel="stylesheet" />
  </head>
  <body>
    <div id="page-container">${doc_html}</div>
    <script src="page-loader.js"></script>
  </body>
</html>`;

  await fs.writeFile("dist/index.html", index_html);
}

main();
