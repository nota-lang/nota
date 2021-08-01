const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const { program } = require("commander");

program.option("-w, --watch");
program.option("-p, --prod");
program.parse(process.argv);
const options = program.opts();

// TODO: find better way to avoid imports on peerDependencies resolving to
//    nota/node_modules
const plugin = {
  name: "test",
  setup(build) {
    build.onResolve({ filter: /^@codemirror/ }, (args) => ({
      path: `${path.resolve(__dirname)}/node_modules/${
        args.path
      }/dist/index.js`,
    }));
  },
};

esbuild
  .build({
    entryPoints: ["src/index.tsx"],
    bundle: true,
    sourcemap: true, //!options.prod,
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
    plugins: [plugin],
  })
  .then(() => {
    fs.copyFileSync("src/index.html", "dist/index.html");
  });
