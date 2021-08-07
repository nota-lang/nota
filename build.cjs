const esbuild = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");
const pkg = require("./package.json");
const { cli } = require("@wcrichto/esbuild-utils");

const options = cli();

esbuild
  .build({
    entryPoints: ["src/index.tsx"],
    format: "cjs",
    bundle: true,
    plugins: [sassPlugin()],
    external: Object.keys(pkg.peerDependencies),
    loader: {
      ".otf": "file",
      ".woff": "file",
      ".woff2": "file",
      ".ttf": "file",
    },
    sourcemap: true,
    outdir: "dist",
    ...options,
  })
  .then(() => console.log("Build complete."))
  .catch(() => process.exit(1));
