const estrella = require("estrella");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));

estrella.build({
  entry: "lib/nota-common.ts",
  outdir: "dist",
  bundle: true,
  format: "esm",
  external: Object.keys(pkg.peerDependencies || {}),
  sourcemap: true,
});
