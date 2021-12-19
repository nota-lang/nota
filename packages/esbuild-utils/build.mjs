import esbuild from "esbuild";
import fs from "fs";
import _ from "lodash";

let pkg = JSON.parse(fs.readFileSync("./package.json"));
let external = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.peerDependencies || {}));

esbuild.build({
  entryPoints: ["lib/esbuild-utils.ts"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  platform: "node",
  sourcemap: true,
  external,
});
