import { cli, copyPlugin } from "@nota-lang/esbuild-utils";

let build = cli();
build({
  plugins: [copyPlugin({ extensions: ["scss"] })],
});
