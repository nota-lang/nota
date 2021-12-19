import { cli, copy_plugin } from "@nota-lang/esbuild-utils";
import { sassPlugin } from "esbuild-sass-plugin";

let build = cli();
build({
  entryPoints: ["lib/nota.ts"],
  platform: "node",
  format: "cjs",
});

build({
  entryPoints: ["lib/editor.tsx"],
  format: "iife",
  plugins: [sassPlugin(), copy_plugin({ extensions: [".html"] })],
});

// let _frontend = build({
//   entryPoints: ["lib/nota-editor.tsx"],
//   outdir: "dist/frontend",
//   format: "iife",
//   loader: {
//     ".otf": "file",
//     ".ttf": "file",
//     ".woff": "file",
//     ".woff2": "file",
//     ".wasm": "file",
//   },
//   plugins: [sassPlugin()],
// }).then(async () => {

//   await fs.writeFile("dist/frontend/index.html", index_html);
// });

// let _backend = build({
//   entryPoints: ["bin/server.ts"],
//   outfile: "dist/backend/server.cjs",
//   format: "cjs",
//   platform: "node",
//   external: ["esbuild"],
// });
