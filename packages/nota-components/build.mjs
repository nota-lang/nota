import fs from "fs/promises";
import { getManifest } from "@nota-lang/esbuild-utils";

async function main() {
  await fs.mkdir('dist', { recursive: true });
  await fs.copyFile("css/nota-components.scss", "dist/index.scss");

  let manifest = getManifest();
  let modules = Object.keys(manifest.peerDependencies)
    .concat(["@nota-lang/nota-components"]);

  await fs.writeFile("dist/peer-dependencies.d.mts", `export const peerDependencies: string[];`);
  await fs.writeFile(
    "dist/peer-dependencies.mjs",
    `export let peerDependencies = ${JSON.stringify(modules)};`
  );

  let imports = modules.map((mod, i) => `import * as _${i} from "${mod == "@nota-lang/nota-components" ? "./index.js" : mod}";`).join("\n");
  let export_ = `export let peerImports = {${modules
    .map((mod, i) => `"${mod}": _${i}`)
    .join(",")}}`;
  await fs.writeFile("dist/peer-imports.d.ts", `export const peerImports: {[mod: string]: any};`);
  await fs.writeFile("dist/peer-imports.js", imports + "\n" + export_);
}

main();
