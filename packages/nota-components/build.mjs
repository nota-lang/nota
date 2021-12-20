import { cli } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";
import fs from "fs";

let build = cli();
build({
  entryPoints: ["lib/nota-components.tsx"],
  plugins: [sassPlugin()],
}).then(([_result, opts]) => {
  let modules = opts.external
    .concat(["@nota-lang/nota-components"])
    .concat([
      "@codemirror/gutter",
      "@codemirror/highlight",
      "@codemirror/language",
      "@codemirror/rangeset",
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/commands",
      "@codemirror/text",
      "@codemirror/autocomplete",
    ]);

  fs.writeFileSync("dist/peer-imports.d.ts", `export const peerImports: {[mod: string]: any};`);

  let imports = modules.map((mod, i) => `import * as _${i} from "${mod}";`).join("\n");
  let export_ = `module.exports = {peerImports: {${modules
    .map((mod, i) => `"${mod}": _${i}`)
    .join(",")}}}`;
  fs.writeFileSync("dist/peer-imports.js", imports + "\n" + export_);

  fs.writeFileSync("dist/peer-dependencies.d.ts", `export const peerDependencies: string[];`);
  fs.writeFileSync(
    "dist/peer-dependencies.js",
    `module.exports = {peerDependencies: ${JSON.stringify(modules)}};`
  );
});
