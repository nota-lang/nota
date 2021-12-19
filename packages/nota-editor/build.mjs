import { cli } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";
import pkg from "@nota-lang/nota-components/dist/peer-dependencies.js";
const { peerDependencies } = pkg;

let build = cli();

build({
  entryPoints: ["lib/nota-editor.tsx"],
  plugins: [sassPlugin()],
  external: peerDependencies,
});
