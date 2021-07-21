const esbuild = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");
const { program } = require("commander");
const pkg = require("./package.json");
const glob = require("glob");

program.option("-w, --watch");
program.option("-p, --prod");
program.parse(process.argv);
const options = program.opts();

esbuild.build({
  entryPoints: glob.sync("src/*.tsx"),
  sourcemap: !options.prod,
  minify: options.prod,
  watch: options.watch,
  format: "esm",
  outdir: "dist",
});

esbuild.build({
  entryPoints: ["assets.js"],
  bundle: true,
  outdir: "dist",
  plugins: [sassPlugin()],
  loader: {
    ".otf": "file",
  },
});
