import { cli, copy_plugin } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";

let shebang = `#!/bin/sh 
":" //# comment; exec /usr/bin/env node  -r @cspotcode/source-map-support/register "$0" "$@"`;

let build = cli();
build({
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  banner: {
    js: shebang,
  },
});

build({
  entryPoints: ["lib/editor.tsx"],
  format: "iife",
  plugins: [sassPlugin(), copy_plugin({ extensions: [".html"] })],
});
