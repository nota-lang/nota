import { cli } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";
import {peerDependencies} from "@nota-lang/nota-components/dist/peer-dependencies.mjs";

let build = cli();

build({
  entryPoints: ["lib/nota-editor.tsx"],
  plugins: [sassPlugin()],
  external: peerDependencies,
});
