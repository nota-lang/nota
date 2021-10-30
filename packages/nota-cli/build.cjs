const estrella = require("estrella");

estrella.build({
  entry: ["lib/nota-cli.ts"],
  outfile: "dist/nota.js",
  format: "cjs",
  platform: "node",
  bundle: true,
  sourcemap: true,
  external: ['esbuild', 'fs', 'path', 'esbuild-sass-plugin']
});