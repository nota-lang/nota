const estrella = require("estrella");
const fs = require("fs/promises");
const { sassPlugin } = require("esbuild-sass-plugin");
const {EsmExternalsPlugin} = require('@esbuild-plugins/esm-externals');


let external = ["react", "react-dom", "mobx", "mobx-react"];
let _components = estrella.build({
  entry: "lib/components.tsx",
  outdir: "dist/components",
  format: "esm",
  external,
  plugins: [EsmExternalsPlugin({externals: external})],
  bundle: true,
  sourcemap: true,
  loader: {
    ".wasm": "file",
  }
});

let _frontend = estrella
  .build({
    entry: "lib/nota-editor.tsx",
    outdir: "dist/frontend",
    bundle: true,
    sourcemap: true,
    loader: {
      ".otf": "file",
      ".ttf": "file",
      ".woff": "file",
      ".woff2": "file",
      ".wasm": "file",
    },
    plugins: [sassPlugin()],
  })
  .then(async () => {
    let index_html = `<!DOCTYPE html>
  <html>
    <head>
      <link href="nota-editor.css" rel="stylesheet" />
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Nota Editor</title>
    </head>
    <body>
      <div id="container"></div>
      <script src="nota-editor.js"></script>
    </body>
  </html>`;

    await fs.writeFile("dist/frontend/index.html", index_html);
  });

let _backend = estrella.build({
  entry: "bin/server.ts",
  outdir: "dist/backend",
  bundle: true,
  sourcemap: true,
  platform: "node",
  external: ["esbuild"],
});
