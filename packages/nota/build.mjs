import { cli, copyPlugin, executablePlugin, getManifest } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";

let pkg = getManifest();
let build = cli();
build({
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  define: {
    VERSION: JSON.stringify(pkg.version),
  },
  plugins: [executablePlugin({paths: ["dist/index.mjs"]})],
})

build({
  entryPoints: ["lib/editor.tsx"],
  format: "iife",
  plugins: [sassPlugin(), copyPlugin({ extensions: [".html", ".ico"] })],
});
