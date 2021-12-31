import { cli, copy_plugin } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";

let build = cli();
build({
  entryPoints: ["lib/nota.ts"],
  platform: "node",
  format: "cjs"
});

build({
  entryPoints: ["lib/editor.tsx"],
  format: "iife",
  plugins: [sassPlugin(), copy_plugin({ extensions: [".html"] })],
});