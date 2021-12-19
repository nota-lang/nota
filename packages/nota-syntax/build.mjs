import { cli } from "@nota-lang/esbuild-utils";
import { lezerPlugin } from "@nota-lang/esbuild-lezer";

let build = cli();
let opts = {
  plugins: [lezerPlugin()],
};

build({
  entryPoints: ["lib/nota-syntax.ts"],
  ...opts,
});

build({
  entryPoints: ["lib/esbuild-plugin.ts"],
  platform: "node",
  ...opts,
});
