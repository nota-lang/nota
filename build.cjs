const esbuild = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");
const { program } = require("commander");
const pkg = require("./package.json");

program.option("-w, --watch");
program.option("-p, --prod");
program.parse(process.argv);
const options = program.opts();

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
    minify: options.prod,
    watch: options.watch,
    outdir: "dist",
  })
  .then(() => console.log("Build complete."))
  .catch(() => process.exit(1));
