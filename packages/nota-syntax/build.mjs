import { cli } from "@nota-lang/esbuild-utils";
import { lezerPlugin } from "@nota-lang/esbuild-lezer";

let build = cli();
let opts = {
  plugins: [lezerPlugin()],
};

build({
  ...opts,
});

build({
  entryPoints: ["lib/esbuild-plugin.ts"],
  platform: "node",
  ...opts,
});
