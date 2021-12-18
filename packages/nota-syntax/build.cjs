const estrella = require("estrella");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));
const { lezerPlugin } = require("@wcrichto/esbuild-lezer");

let external = Object.keys(pkg.dependencies || {});

let opts = {
  outdir: "dist",
  bundle: true,
  format: "esm",
  external,
  plugins: [lezerPlugin()],
  sourcemap: true,
};

estrella.build({
  entryPoints: ["lib/nota-syntax.ts"],
  platform: "browser",
  ...opts,
});

estrella.build({
  entryPoints: ["lib/esbuild-plugin.ts"],
  platform: "node",
  ...opts,
});
