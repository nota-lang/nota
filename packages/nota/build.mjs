import { cli, copy_plugin } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";

let build = cli();
build({
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
});

build({
  entryPoints: ["lib/editor.tsx"],
  format: "iife",
  plugins: [sassPlugin(), copy_plugin({ extensions: [".html"] })],
});