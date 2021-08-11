const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const pkg = require("./package.json");
const { cli, avoidDevPeerConflicts, copyPlugin } = require("@wcrichto/esbuild-utils");

const options = cli();

let esbuild_opts = {
  sourcemap: true,
  bundle: true,
  outdir: "dist",
  loader: {
    ".otf": "file",
    ".woff": "file",
    ".woff2": "file",
    ".ttf": "file",
    ".bib": "text",
  },
  ...options,
};

let build_paper = esbuild.build({
  entryPoints: ["src/paper.tsx"],
  format: "esm",
  external: Object.keys(pkg.peerDependencies),
  ...esbuild_opts,
});

let build_page = esbuild.build({
  entryPoints: ["src/index.tsx"],
  plugins: [avoidDevPeerConflicts({ pkg }), copyPlugin({ extensions: [".html"] })],
  ...esbuild_opts,
});

Promise.all([build_paper, build_page])
  .then(() => console.log("Build complete."))
  .catch(() => process.exit(1));
