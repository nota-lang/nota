import { cli, copy_plugin, executable_plugin, get_manifest } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";

let pkg = get_manifest();
let build = cli();
build({
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  define: {
    VERSION: JSON.stringify(pkg.version),
  },
  plugins: [executable_plugin(["dist/index.mjs"])],
})

build({
  entryPoints: ["lib/editor.tsx"],
  format: "iife",
  plugins: [sassPlugin(), copy_plugin({ extensions: [".html", ".ico"] })],
});
