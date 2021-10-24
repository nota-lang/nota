const estrella = require("estrella");
const { sassPlugin } = require("esbuild-sass-plugin");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));

estrella.build({
  entry: "lib/nota-theme-acm.tsx",
  outdir: "dist",
  bundle: true,
  format: "cjs",
  plugins: [sassPlugin()],
  external: Object.keys(pkg.peerDependencies || {}),
  sourcemap: true,
  loader: {
    ".otf": "file",
    ".woff": "file",
    ".woff2": "file",
    ".ttf": "file",
  },
});
