const estrella = require("estrella");
const fs = require("fs");
const {sassPlugin} = require("esbuild-sass-plugin");

estrella
  .build({
    entry: ["lib/nota-editor.tsx"],
    outfile: "dist/index.js",
    bundle: true,
    sourcemap: true,
    loader: {
      ".otf": "file",
      ".ttf": "file",
      ".woff": "file",
      ".woff2": "file"
    },
    plugins: [sassPlugin()],
  })
  .then(() => {
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

    fs.writeFileSync("dist/index.html", index_html);
  });
