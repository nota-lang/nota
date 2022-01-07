import { cli, copy_plugin, executable_plugin } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";

let build = cli();
build({
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  plugins: [executable_plugin(["dist/index.mjs"])],
})

build({
  entryPoints: ["lib/editor.tsx"],
  format: "iife",
  plugins: [sassPlugin(), copy_plugin({ extensions: [".html"] })],
});
