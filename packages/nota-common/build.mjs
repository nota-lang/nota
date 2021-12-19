import { cli } from "@nota-lang/esbuild-utils";

let build = cli();
build({
  entryPoints: ["lib/nota-common.ts"],
});
