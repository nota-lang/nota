const estrella = require("estrella");
const { sassPlugin } = require("esbuild-sass-plugin");
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("./package.json"));
const {EsmExternalsPlugin} = require('@esbuild-plugins/esm-externals');


let external = Object.keys(pkg.peerDependencies || {});

estrella.build({
  entry: "lib/nota.tsx",
  outfile: "dist/nota.js",
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
  // TODO: not getting picked up by nota-cli?
  fs.writeFileSync(
    "dist/peer-dependencies.d.ts",
    `declare module '@wcrichto/nota/dist/peer-dependencies.mjs' {
      const peerDependencies: string[]; export default peerDependencies;
    }`
  );
  fs.writeFileSync(
    "dist/peer-dependencies.mjs", 
    `export default ${JSON.stringify(external)};`
  );
})
