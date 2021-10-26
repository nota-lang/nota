#!/usr/bin/env node --enable-source-maps

import { program } from "commander";
import esbuild from "esbuild";
import path from "path";
import { promises as fs } from "fs";
import { sassPlugin } from "esbuild-sass-plugin";
import { notaMarkdown } from "@wcrichto/nota-markdown";

program.version("0.1.0").option("-w, --watch").argument("<input>");

program.parse(process.argv);
let opts = program.opts();

let input_path = path.resolve(program.args[0]);
let injected_document_plugin: esbuild.Plugin = {
  name: "injected_document_plugin",
  setup(build) {
    build.onResolve({ filter: /injected-document/ }, _args => ({
      path: input_path,
    }));
  },
};
let page_path = path.resolve(path.join(__dirname, "..", "lib", "page.tsx"));

esbuild
  .build({
    entryPoints: [page_path],
    outdir: "dist",
    bundle: true,
    plugins: [notaMarkdown(), sassPlugin() as any, injected_document_plugin],
    sourcemap: true,
    loader: {
      ".otf": "file",
      ".woff": "file",
      ".woff2": "file",
      ".ttf": "file",
      ".bib": "text",
    },

    watch: opts.watch,
  })
  .then(() => {
    let index_html = `
  <html>
    <head>
      <link href="page.css" rel="stylesheet" />
    </head>
    <body>
      <div id="page-container"></div>
      <script src="page.js"></script>
    </body>
  </html>`;

    fs.writeFile("dist/index.html", index_html);
  });
