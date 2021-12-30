import { cli } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";

let build = cli();
build({
  entryPoints: ["lib/nota-theme-acm.tsx"],
  plugins: [sassPlugin()],
});