const estrella = require("estrella");
const fs = require("fs/promises");
const { sassPlugin } = require("esbuild-sass-plugin");

let frontend = estrella.build({
  entry: "lib/nota-editor.tsx",
  outfile: "dist/frontend/index.js",
  bundle: true,
  sourcemap: true,
  loader: {
    ".otf": "file",
    ".ttf": "file",
    ".woff": "file",
    ".woff2": "file",
  },
  plugins: [sassPlugin()],
});

let html = (async () => {
  let index_html = `<!DOCTYPE html>
  <html>
    <head>
      <link href="index.css" rel="stylesheet" />
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Nota Editor</title>
    </head>
    <body>
      <div id="container"></div>
      <script src="index.js"></script>
    </body>
  </html>`;

  await fs.writeFile("dist/frontend/index.html", index_html);
})();

let backend = estrella.build({
  entry: "bin/server.ts",
  outfile: "dist/backend/server.js",
  bundle: true,
  sourcemap: true,
  platform: "node",
  external: ["esbuild"],
});
