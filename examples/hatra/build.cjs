const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const pkg = require("./package.json");
const { program } = require("commander");
const fse = require("fs-extra");

program.option("-w, --watch");
program.option("-p, --prod");
program.parse(process.argv);
const options = program.opts();

const avoid_peerdep_conflicts_plugin = {
  name: "test",
  setup(build) {
    Object.keys(pkg.peerDependencies).forEach(k => {
      let peer_pkg = require(`./node_modules/${k}/package.json`);
      let filter = new RegExp(`^${k}$`);
      build.onResolve({ filter }, args => ({
        path: `${path.resolve(__dirname)}/node_modules/${args.path}/${peer_pkg.main}`,
      }));
    });
  },
};

esbuild
  .build({
    entryPoints: ["src/index.tsx"],
    bundle: true,
    sourcemap: true,
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
    plugins: [avoid_peerdep_conflicts_plugin],
  })
  .then(() => {
    fse.copy("src/index.html", "dist/index.html");
    fse.copy("slicing_paper.pdf", "dist/slicing_paper.pdf");
    fse.copy("node_modules/slicing/dist", "dist/slicing");
  });
