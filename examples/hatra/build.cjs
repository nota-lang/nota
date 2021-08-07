const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const pkg = require("./package.json");
const fse = require("fs-extra");
const { cli, avoidSymlinkConflictsPlugin, copyPlugin } = require("@wcrichto/esbuild-utils");

const options = cli();

esbuild
  .build({
    entryPoints: ["src/index.tsx"],
    bundle: true,
    sourcemap: true,
    minify: options.prod,
    watch: options.watch,
    preserveSymlinks: true,
    format: "esm",
    loader: {
      ".otf": "file",
      ".woff": "file",
      ".woff2": "file",
      ".ttf": "file",
      ".bib": "text",
    },
    outdir: "dist",
    plugins: [avoidSymlinkConflictsPlugin({ pkg }), copyPlugin({ extensions: [".html", ".pdf"] })],
  })
  .then(() => {
    fse.copy("node_modules/slicing/dist", "dist/slicing");
  });
