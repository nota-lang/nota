const estrella = require("estrella");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));

estrella.build({
  entry: ["lib/nota-cli.tsx"],
  outdir: "dist",
  bundle: true,
  format: "cjs",
  platform: "node",
  external: Object.keys(pkg.peerDependencies),
  sourcemap: true,
});