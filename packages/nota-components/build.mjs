import { cli } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";
import fs from "fs";

// These are all the packages within @codemirror/basic-setup
let cm_deps = [
  "@codemirror/autocomplete",
  "@codemirror/closebrackets",
  "@codemirror/commands",
  "@codemirror/comment",
  "@codemirror/fold",
  "@codemirror/gutter",
  "@codemirror/highlight",
  "@codemirror/history",
  "@codemirror/language",
  "@codemirror/lint",
  "@codemirror/matchbrackets",
  "@codemirror/rectangular-selection",
  "@codemirror/search",
  "@codemirror/state",
  "@codemirror/view",
];

let build = cli();
build({
  external: cm_deps,
  plugins: [sassPlugin()],
}).then(([_result, opts]) => {
  let modules = opts.external.concat(["@nota-lang/nota-components"]);

  fs.writeFileSync("dist/peer-dependencies.d.mts", `export const peerDependencies: string[];`);
  fs.writeFileSync(
    "dist/peer-dependencies.mjs",
    `export let peerDependencies = ${JSON.stringify(modules)};`
  );

  let imports = modules.map((mod, i) => `import * as _${i} from "${mod}";`).join("\n");
  let export_ = `export let peerImports = {${modules
    .map((mod, i) => `"${mod}": _${i}`)
    .join(",")}}`;
  fs.writeFileSync("dist/peer-imports.d.ts", `export const peerImports: {[mod: string]: any};`);
  fs.writeFileSync("dist/peer-imports.js", imports + "\n" + export_);
});
