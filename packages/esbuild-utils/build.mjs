import esbuild from "esbuild";
import fs from "fs";
import { EsmExternalsPlugin } from "@esbuild-plugins/esm-externals";

let pkg = JSON.parse(fs.readFileSync("./package.json"));
let external = Object.keys(pkg.peerDependencies || {});

esbuild.build({
  entryPoints: ["lib/esbuild-utils.ts"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  platform: "node",
  sourcemap: true,
  plugins: [EsmExternalsPlugin({ externals: external })],
  external,
});
