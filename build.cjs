const esbuild = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");
const { program } = require("commander");
const pkg = require("./package.json");
const glob = require("glob");

program.option("-w, --watch");
program.option("-p, --prod");
program.parse(process.argv);
const options = program.opts();

let esbuild_opts = {
  sourcemap: true, //!options.prod,
  minify: options.prod,
  watch: options.watch,
  outdir: "dist",
}

let build_js = esbuild.build({
  entryPoints: glob.sync("src/*.tsx"),
  format: "esm",
  ...esbuild_opts
});

let build_assets = esbuild.build({
  entryPoints: ["assets.js"],
  bundle: true,
  plugins: [sassPlugin()],
  loader: {
    ".otf": "file",
    ".woff": "file",
    ".woff2": "file",
    ".ttf": "file",
    ".otf": "file",
  },
  ...esbuild_opts
});

Promise.all([build_js, build_assets])
  .then(() => console.log("Build complete."))
  .catch(() => process.exit(1))
