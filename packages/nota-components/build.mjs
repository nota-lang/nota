import fs from "fs/promises";
import { getManifest } from "@nota-lang/esbuild-utils";

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
  await fs.mkdir('dist', {recursive: true});
  await fs.copyFile("css/nota-components.scss", "dist/index.scss");

  let manifest = getManifest();
  let modules = cmDeps
    .concat(Object.keys(manifest.peerDependencies || {}))
    .concat(["@nota-lang/nota-components"]);

  await fs.writeFile("dist/peer-dependencies.d.mts", `export const peerDependencies: string[];`);
  await fs.writeFile(
    "dist/peer-dependencies.mjs",
    `export let peerDependencies = ${JSON.stringify(modules)};`
  );

  let imports = modules.map((mod, i) => `import * as _${i} from "${mod}";`).join("\n");
  let export_ = `export let peerImports = {${modules
    .map((mod, i) => `"${mod}": _${i}`)
    .join(",")}}`;
  await fs.writeFile("dist/peer-imports.d.ts", `export const peerImports: {[mod: string]: any};`);
  await fs.writeFile("dist/peer-imports.js", imports + "\n" + export_);
}

main();
