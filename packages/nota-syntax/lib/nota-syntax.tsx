//@ts-ignore
import {parser} from "./nota.grammar";
import type esbuild from "esbuild";
import fs from "fs";
import { Text } from "./ast";
import { translate_textbody, set_input } from "./translate";
import * as nota from "@wcrichto/nota";
import prettier from "prettier";
import indentString from 'indent-string';

export let notaSyntax: () => esbuild.Plugin = () => ({
  name: "syntax",
  setup(build) {
    build.onLoad({ filter: /\.nota$/ }, async args => {
      let input = await fs.promises.readFile(args.path, "utf8");
      let tree = parser.parse(input);

      function depth(node) {
        return node.parent ? 1 + depth(node.parent) : 0;
      }
      
      let cursor = tree.cursor();
      do {
        let sub_input = input.slice(cursor.from, cursor.to);
        console.log(indentString(`${cursor.name}: "${sub_input}"`, 2 * depth(cursor.node)));
      } while (cursor.next());

   
      set_input(input);
      console.log(translate_textbody(tree.topNode.firstChild));

      return {contents: '', loader: 'js'};
      // let text = await fs.promises.readFile(args.path, "utf8");
      // let ast: Text;
      // try {
      //   ast = parser.parse(text, {
      //     grammarSource: args.path,
      //   });
      // } catch (e: any) {
      //   if (!(e instanceof parser.SyntaxError)) {
      //     throw e;
      //   } else {
      //     throw e.format([{ source: args.path, text }]);
      //   }
      // }

      // let nota_import = `import {${Object.keys(nota).join(",")}} from "@wcrichto/nota"`;
      // let imports = [`import React from "react";`, nota_import];
      
      // let doc = translate_text(ast);
      // doc = prettier.format(doc, {parser: "babel"});
      // console.log(doc);

      // let contents = [
      //   ...imports, 
      //   `const r = String.raw;`,
      //   `export default () => ${doc}`
      // ].join("\n");

      // return {
      //   contents,
      //   loader: "js",
      // };
    });
  },
});
