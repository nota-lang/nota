const esbuild = require("esbuild");
const fs = require("fs");
const { program } = require("commander");

program.option("-w, --watch");
program.option("-p, --prod");
program.parse(process.argv);
const options = program.opts();

esbuild
  .build({
    entryPoints: ["src/index.tsx"],
    bundle: true,
    sourcemap: !options.prod,
    minify: options.prod,
    watch: options.watch,
    preserveSymlinks: true,
    format: "esm",
    loader: {
      ".otf": "file",
      ".woff": "file",
      ".woff2": "file",
      ".ttf": "file",
      ".bib": "text",
    },
    outdir: "dist",
  })
  .then(() => {
    fs.copyFileSync("src/index.html", "dist/index.html");
  });
