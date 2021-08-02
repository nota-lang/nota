const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const pkg = require("./package.json");
const { program } = require("commander");

program.option("-w, --watch");
program.option("-p, --prod");
program.parse(process.argv);
const options = program.opts();

// TODO: find better way to avoid imports on peerDependencies resolving to
//    nota/node_modules
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

let esbuild_opts = {
  sourcemap: !options.prod,
  minify: options.prod,
  watch: options.watch,
  bundle: true,
  outdir: "dist",
  preserveSymlinks: true,
  loader: {
    ".otf": "file",
    ".woff": "file",
    ".woff2": "file",
    ".ttf": "file",
    ".bib": "text",
  },
};

let build_paper = esbuild.build({
  entryPoints: ["src/paper.tsx"],
  format: "esm",
  external: Object.keys(pkg.peerDependencies),
  ...esbuild_opts,
});

let build_page = esbuild
  .build({
    entryPoints: ["src/index.tsx"],
    plugins: [avoid_peerdep_conflicts_plugin],
    ...esbuild_opts,
  })
  .then(() => {
    fs.copyFileSync("src/index.html", "dist/index.html");
  });

Promise.all([build_paper, build_page])
  .then(() => console.log("Build complete."))
  .catch(() => process.exit(1));
