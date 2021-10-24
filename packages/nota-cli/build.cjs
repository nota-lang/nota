const estrella = require("estrella");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));

const copy_template_plugin = {
  name: "copy_template_plugin",
  setup(build) {
    build.onEnd(_ => {
      fs.copyFileSync("./lib/page-loader.tsx", "./dist/page-loader.tsx");
    });
  },
};

estrella.build({
  entry: ["lib/nota-cli.tsx"],
  outdir: "dist",
  bundle: true,
  format: "cjs",
  platform: "node",
  external: Object.keys(pkg.peerDependencies),
  sourcemap: true,
  plugins: [copy_template_plugin]
});