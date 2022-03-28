import { cli } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";
import fs from "fs/promises";

// These are all the packages within @codemirror/basic-setup
let cmDeps = [
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

async function main() {
  let build = cli();
  let [_result, opts] = await build({
    external: cmDeps,
    plugins: [sassPlugin()],
  });

  let modules = opts.external.concat(["@nota-lang/nota-components"]);

  let p1 = fs.writeFile("dist/peer-dependencies.d.mts", `export const peerDependencies: string[];`);
  let p2 = fs.writeFile(
    "dist/peer-dependencies.mjs",
    `export let peerDependencies = ${JSON.stringify(modules)};`
  );

  let imports = modules.map((mod, i) => `import * as _${i} from "${mod}";`).join("\n");
  let export_ = `export let peerImports = {${modules
    .map((mod, i) => `"${mod}": _${i}`)
    .join(",")}}`;
  let p3 = fs.writeFile(
    "dist/peer-imports.d.ts",
    `export const peerImports: {[mod: string]: any};`
  );
  let p4 = fs.writeFile("dist/peer-imports.js", imports + "\n" + export_);

  await Promise.all([p1, p2, p3, p4]);
}

main();