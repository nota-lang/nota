const estrella = require("estrella");

estrella.build({
  entry: ["lib/nota-cli.ts"],
  outfile: "dist/nota.mjs",
  format: "esm",
  platform: "node",
  sourcemap: true,
});