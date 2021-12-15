const estrella = require("estrella");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));

let external = Object.keys(pkg.peerDependencies || {});

estrella.build({
  entry: "lib/esbuild-lezer.ts",
  outdir: "dist",
  bundle: true,
  format: "cjs",
  platform: "node",
  sourcemap: true,
  external,
});
