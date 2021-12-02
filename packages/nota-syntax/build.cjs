const estrella = require("estrella");
const fs = require("fs");
const path = require("path");
const generator = require("@lezer/generator");
const _ = require("lodash");

const lezer_plugin = grammars => ({
  name: "lezer",
  setup(build) {
    let term_builds = _.fromPairs(
      grammars.map(name => {
        let resolve;
        let promise = new Promise(r => {
          resolve = r;
        });
        return [name, { promise, resolve }];
      })
    );

    build.onResolve({ filter: /\.terms$/ }, async args => ({
      path: args.path,
      namespace: "lezer-terms",
    }));

    build.onLoad({ filter: /.*/, namespace: "lezer-terms" }, async args => {
      let contents = await term_builds[path.basename(args.path, ".terms")].promise;
      return {
        contents,
        loader: "js",
      };
    });

    build.onLoad({ filter: /\.grammar$/ }, async args => {
      let text = await fs.promises.readFile(args.path, "utf8");
      let { parser, terms } = generator.buildParserFile(text, {
        fileName: args.path,
        includeNames: true,
      });
      term_builds[path.basename(args.path, ".grammar")].resolve(terms);
      return {
        contents: parser,
        loader: "js",
      };
    });
  },
});

estrella.build({
  entryPoints: ["lib/nota-syntax.ts", "lib/esbuild-plugin.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  external: ["prettier"],
  plugins: [lezer_plugin(["nota"])],
  sourcemap: true,
  define: {
    process: JSON.stringify({ env: {} }),
  },
});
