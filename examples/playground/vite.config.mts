import { result } from "@nota-lang/nota-common";
import { parse, translate } from "@nota-lang/nota-syntax";
import react from "@vitejs/plugin-react";
import path from "path";
import { Plugin, ViteDevServer, createServer, defineConfig } from "vite";

let jsTemplate = (url: string) => `
import Document from "${url}";
import ReactDOMServer from "react-dom/server";
export default ReactDOMServer.renderToString(<Document />);
`;

let htmlTemplate = (src: string) => `
<!DOCTYPE html>
<html>
  <head>  
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script src="${src}" type="module" async></script>
  </body>
</html>
`;

let withExt = (p: string, ext: string) => path.format({ ...path.parse(p), base: undefined, ext });

let notaPlugin = (): Plugin => {
  // let vite: ViteDevServer;
  return {
    name: "nota",
    async buildStart() {
      // vite = await createServer({
      //   server: { middlewareMode: true },
      //   appType: "custom",
      // });
    },
    resolveId(src, importer, options) {
      if (options.isEntry) return src;
      return null;
    },
    async load(src) {
      if (src.endsWith(".html")) {
        let { code } = await this.load({ id: withExt(src, ".html.jsx") });
        console.log(code);
        // let notaSrc = path.format({ ...path.parse(src), base: undefined, ext: ".nota" });
        // await this.transform(jsTemplate(notaSrc, "index.js"));
        // // let js = await this.load(notaSrcResolved);
        // // console.log(js.code);

        // return htmlTemplate(notaSrc);
      } else if (src.endsWith(".html.jsx")) {
        let notaSrc = withExt(src, ".nota");
        return jsTemplate(notaSrc);
      }

      return null;
    },
    transform(code, id) {
      if (!id.endsWith(".nota")) return;

      let res = parse.tryParse(code);
      if (!result.isOk(res)) throw res.value;
      let tree = res.value;

      return translate.translate({
        input: code,
        tree,
        inputPath: id,
      });
    },
  };
};

export default defineConfig({
  plugins: [react(), notaPlugin()],
});
