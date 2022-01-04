import esbuild from "esbuild";
import fs from "fs";
import _ from "lodash";

let pkg = JSON.parse(fs.readFileSync("./package.json"));
let external = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.peerDependencies || {}));

let watch = process.argv.includes('-w');

esbuild.build({
  entryPoints: ["lib/index.ts"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  platform: "node",
  sourcemap: true,
  watch,
  external,
});

esbuild.build({
  entryPoints: ["lib/template.tsx"],
  outdir: "dist",
  bundle: true,
  external: ["react"],
  format: "esm",
  sourcemap: true,
  watch
});