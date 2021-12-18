const estrella = require("estrella");
const { sassPlugin } = require("esbuild-sass-plugin");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));
const {EsmExternalsPlugin} = require('@esbuild-plugins/esm-externals');

let external = Object.keys(pkg.peerDependencies || {});

estrella.build({
  entry: "lib/nota-components.tsx",
  outdir: "dist",
  bundle: true,
  format: "esm",
  plugins: [sassPlugin(), EsmExternalsPlugin({externals: external})],
  external,
  sourcemap: true,
  loader: {
    ".otf": "file",
    ".woff": "file",
    ".woff2": "file",
    ".ttf": "file",    
  }
}).then(_ => {
  let modules = external.concat(['@wcrichto/nota-components']);
  
  fs.writeFileSync(
    "dist/peer-imports.d.ts",
    `declare const peerImports: {[mod: string]: any}; export default peerImports;`
  );

  let imports = modules.map((mod, i) => `import * as _${i} from "${mod}";`).join("\n");
  let export_ = `export default {${modules.map((mod, i) => `"${mod}": _${i}`).join(",")}}`;
  fs.writeFileSync(
    "dist/peer-imports.js", imports + "\n" + export_,    
  );

  fs.writeFileSync(
    "dist/peer-dependencies.d.ts",
    `declare const peerDependencies: string[]; export default peerDependencies;`
  );
  fs.writeFileSync(
    "dist/peer-dependencies.js", 
    `export default ${JSON.stringify(modules)};`
  );
})
