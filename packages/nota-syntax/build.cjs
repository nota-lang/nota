const estrella = require("estrella");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));
const esbuild = require("esbuild");
const peggy = require("peggy");
const path = require("path");
const generator = require("@lezer/generator");

const lezer_plugin = {
  name: "lezer",
  setup(build) {
    let all_terms = {};

    build.onResolve({ filter: /\.terms$/ }, async args => ({
      path: args.path,
      namespace: "lezer-terms",
    }));

    build.onLoad({ filter: /.*/, namespace: "lezer-terms" }, async args => {
      let contents = all_terms[path.basename(args.path, ".terms")];
      return {
        contents,
        loader: "js",
      };
    });

    build.onLoad({ filter: /\.grammar$/ }, async args => {
      let text = await fs.promises.readFile(args.path, "utf8");
      let { parser, terms } = generator.buildParserFile(text, {
        fileName: args.path,
      });
      all_terms[path.basename(args.path, ".grammar")] = terms;
      return {
        contents: parser,
        loader: "js",
      };
    });
  },
};

estrella.build({
  entry: "lib/nota-syntax.tsx",
  outdir: "dist",
  bundle: true,
  platform: "node",
  external: ["prettier"],
  plugins: [lezer_plugin],
  sourcemap: true,
});
