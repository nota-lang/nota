import { cli } from "@nota-lang/esbuild-utils";
import { lezerPlugin } from "@nota-lang/esbuild-lezer";
import * as components from "@nota-lang/nota-components";

let build = cli();
let opts = {
  plugins: [lezerPlugin()],
  define: { COMPONENTS: JSON.stringify(Object.keys(components)) },
};

build({
  ...opts,
});

build({
  entryPoints: ["lib/esbuild-plugin.ts"],
  platform: "node",
  ...opts,
});
