#!/usr/bin/env node --enable-source-maps

import { program } from "commander";
import esbuild from "esbuild";
import path from "path";
import { promises as fs } from "fs";
import { sassPlugin } from "esbuild-sass-plugin";
import { notaMarkdown } from "@wcrichto/nota-markdown";
import notaPeers from "@wcrichto/nota/dist/peer-dependencies.js";

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

let common_opts: Partial<esbuild.BuildOptions> = {
  watch: opts.watch,
  sourcemap: true,
  bundle: true,
  plugins: [notaMarkdown(), sassPlugin()],
  loader: {
    ".otf": "file",
    ".woff": "file",
    ".woff2": "file",
    ".ttf": "file",
    ".bib": "text",
  },
};

let doc_build = esbuild.build({
  ...common_opts,
  entryPoints: [input_path],
  format: 'esm',
  outfile: "dist/document/document.js",
  external: [...notaPeers, "@mdx-js/react", "@wcrichto/nota"]
});

let page_build = esbuild.build({
  ...common_opts,
  entryPoints: [page_path],
  outfile: "dist/page/index.js",
  plugins: [...common_opts.plugins!, injected_document_plugin],
});

Promise.all([doc_build, page_build])
  .then(() => {
    let index_html = `<!DOCTYPE html>
<html>
  <head>
    <link href="index.css" rel="stylesheet" />
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <div id="page-container"></div>
    <script src="index.js"></script>
  </body>
</html>`;

    fs.writeFile("dist/page/index.html", index_html);
  })
  .then(_ => console.log("Build succeeded."))
  .catch(_ => console.error("Build failed."));
