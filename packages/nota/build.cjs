const estrella = require("estrella");
const { sassPlugin } = require("esbuild-sass-plugin");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));

estrella.build({
  entry: "lib/nota.tsx",
  outfile: "dist/nota.js",
  bundle: true,
  format: "cjs",
  plugins: [sassPlugin()],
  external: Object.keys(pkg.peerDependencies),
  sourcemap: true,
});
