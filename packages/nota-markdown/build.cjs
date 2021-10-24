const estrella = require("estrella");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));

estrella.build({
  entry: "lib/nota-markdown.tsx",
  outdir: "dist",
  bundle: true,
  platform: 'node',
  external: Object.keys(pkg.peerDependencies || {}),
  sourcemap: true,
});
