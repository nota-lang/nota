import { cli } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";
import fs from "fs";

let build = cli();
build({
  entryPoints: ["lib/nota-components.tsx"],
  plugins: [sassPlugin()],
  loader: {
    ".otf": "file",
    ".woff": "file",
    ".woff2": "file",
    ".ttf": "file",
  },
}).then(([_result, opts]) => {
  let modules = opts.external.concat(["@nota-lang/nota-components"]);

  fs.writeFileSync(
    "dist/peer-imports.d.ts",
    `export const peerImports: {[mod: string]: any};`
  );

  let imports = modules.map((mod, i) => `import * as _${i} from "${mod}";`).join("\n");
  let export_ = `export let peerImports = {${modules.map((mod, i) => `"${mod}": _${i}`).join(",")}}`;
  fs.writeFileSync("dist/peer-imports.js", imports + "\n" + export_);

  fs.writeFileSync(
    "dist/peer-dependencies.d.ts",
    `export const peerDependencies: string[];`
  );
  fs.writeFileSync("dist/peer-dependencies.js", `export let peerDependencies = ${JSON.stringify(modules)};`);
});
