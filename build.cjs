const esbuild = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");
const { program } = require("commander");
const pkg = require("./package.json");

program.option("-w, --watch");
program.option("-p, --prod");
program.parse(process.argv);
const options = program.opts();

esbuild.build({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  sourcemap: !options.prod,
  minify: options.prod,
  watch: options.watch,
  format: "esm",
  loader: {
    ".otf": "file",
    ".woff": "file",
    ".woff2": "file",
    ".ttf": "file",
  },
  outdir: "dist",
  outExtension: {
    ".js": ".mjs",
  },
  external: Object.keys(pkg.peerDependencies),
  plugins: [sassPlugin()],
});
