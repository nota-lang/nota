import { cli, copy_plugin } from "@nota-lang/esbuild-utils";

let build = cli();
build({
  plugins: [copy_plugin({ extensions: ["scss"] })],
});
