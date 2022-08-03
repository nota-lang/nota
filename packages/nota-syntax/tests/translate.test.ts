import type { BabelFileResult } from "@babel/core";
import * as babel from "@babel/standalone";
import type { Statement } from "@babel/types";
import type { SyntaxNode } from "@lezer/common";
import { resUnwrap } from "@nota-lang/nota-common/dist/result.js";
import fs from "fs/promises";
import _ from "lodash";
import path from "path";
import parserBabel from "prettier/parser-babel";
import prettier from "prettier/standalone";
import { MappingItem, SourceMapConsumer } from "source-map";

import { mdTerms, tryParse } from "../dist/parse/mod.js";
import {
  LineMap,
  Translator,
  optimizePlugin,
  printTree,
  babelPolyfill as t,
  translate as trans,
} from "../dist/translate/mod.js";

const r = String.raw;

test("translate end-to-end", () => {
  let input = `@h1: Hello $world!$`;
  let tree = resUnwrap(tryParse(input));
  let { code } = trans({ input, tree });
  let expected = `
import { createElement as el, Fragment } from "react";
import { observer } from "mobx-react";
import { document, tex } from "@nota-lang/nota-components";
import "@nota-lang/nota-components/dist/index.css";
const {
  Document
} = document;
const {
  $
} = tex;
export default observer(function TheDocument(docProps) {
  return el(Document, docProps, el("h1", {}, "Hello ", el($, {}, "world!")));
});`;
  expect(code).toBe(expected.trim());
});

test("translate with debug exports", () => {
  let input = `% import _ from "lodash";`;
  let tree = resUnwrap(tryParse(input));
  let { code } = trans({ input, tree, debugExports: true });
  let expected = r`
import { createElement as el, Fragment } from "react";
import { observer } from "mobx-react";
import { document } from "@nota-lang/nota-components";
import "@nota-lang/nota-components/dist/index.css";
const {
  Document
} = document;
import _ from "lodash";
import import0_default, * as import0 from "lodash";
export let imports = {
  "lodash": { ...import0,
    "__esModule": true,
    "default": import0_default
  }
};
export let source = "% import _ from \"lodash\";";
export default observer(function TheDocument(docProps) {
  return el(Document, docProps, null);
});
`;
  expect(code).toBe(expected.trim());
});

let gen =
  (f: (tr: Translator, node: SyntaxNode) => Statement) =>
  (input: string): string => {
    try {
      let tree = resUnwrap(tryParse(input));
      // printTree(tree, input);
      let translator = new Translator(input);
      let stmt = f(translator, tree.topNode);
      let program = t.program([stmt]);
      let result = babel.transformFromAst(program, undefined, {
        plugins: [optimizePlugin],
      }) as any as BabelFileResult;
      return prettier.format(result.code!, { parser: "babel", plugins: [parserBabel] }).trimEnd();
    } catch (e) {
      console.error(input);
      throw e;
    }
  };

let bless = "BLESS" in process.env;

let snapshotTests = async (dir: string, trans: (input: string) => string) => {
  let fullDir = path.join(__dirname, dir);
  let files = await fs.readdir(fullDir);
  let tests = files.filter(p => !p.endsWith(".expected"));
  await Promise.all(
    tests.map(async p => {
      let input = await fs.readFile(path.join(fullDir, p), "utf-8");
      let output = trans(input);

      let expectedPath = path.join(fullDir, p + ".expected");
      if (bless) {
        await fs.writeFile(expectedPath, output);
      } else {
        let expected = await fs.readFile(expectedPath, "utf-8");
        if (expected != output) {
          console.log(`Input:\n${input}`);
          console.log(`Expected:\n${expected}`);
          console.log(`Actual:\n${output}`);
          throw new Error(`Failed snapshot test: ${dir}/${p}`);
        }
      }
    })
  );
};

test("translate markdown inline", async () => {
  let genInlineMarkdown = gen((translator, doc) => {
    let para = doc.getChild(mdTerms.Paragraph)!;
    let expr = translator.translateMdInline(para.firstChild!);
    return t.expressionStatement(expr);
  });

  await snapshotTests("inline", genInlineMarkdown);
});

test("translate markdown block", async () => {
  let genBlockMarkdown = gen((translator, doc) => {
    let block = doc.firstChild!;
    // LMAO: the space between "MdBlock" and "(block)" is important
    // because esbuild-jest will otherwise see the substring "ock (" (no space)
    // in my code, and then cause a SyntaxError.
    // See: https://github.com/aelbore/esbuild-jest/issues/57
    let f = translator.translateMdBlock.bind(translator);
    let [expr] = f(block);
    return t.expressionStatement(expr);
  });

  await snapshotTests("block", genBlockMarkdown);
});

test("translate markdown doc", async () => {
  let genDocMarkdown = gen((translator, doc) => {
    let expr = translator.translateMdDocument(doc);
    return t.expressionStatement(expr);
  });

  await snapshotTests("doc", genDocMarkdown);
});

test("line map", () => {
  let input = `foo
bar
bleck`;
  let map = new LineMap(input);
  let pairs: [number, { line: number; column: number }][] = [
    [0, { line: 1, column: 0 }],
    [3, { line: 1, column: 3 }],
    [4, { line: 2, column: 0 }],
    [8, { line: 3, column: 0 }],
    [13, { line: 3, column: 5 }],
  ];
  pairs.forEach(([pos, loc]) => {
    // console.log(pos, loc, map.offsetToLocation(pos));
    expect(map.offsetToLocation(pos)).toStrictEqual(loc);
  });
});

test("translate source map", async () => {
  let input = `@h1:
  Hello *world*! #yep{}`;

  let tree = resUnwrap(tryParse(input));
  let { code, map } = trans({ input, tree, inputPath: "test.nota" });
  // console.log(code);

  if (!map) throw new Error("No source map");

  let pairs = [
    ["@h1", `el("h1"`],
    ["*world*", `el("em"`],
    ["#yep", `yep([])`],
  ];

  let srcMap = new LineMap(input);
  let dstMap = new LineMap(code);

  await SourceMapConsumer.with(map, null, consumer => {
    let mappings: MappingItem[] = [];
    consumer.eachMapping(m => {
      mappings.push(m);
    });

    // console.log(mappings);

    pairs.forEach(([src, dst]) => {
      let srcIndex = input.indexOf(src);
      if (srcIndex == -1) {
        throw new Error(`Bad srcIndex for: ${src}`);
      }
      let dstIndex = code!.indexOf(dst);
      if (dstIndex == -1) {
        throw new Error(`Bad dstIndex for: ${dst}`);
      }
      let srcLoc = srcMap.offsetToLocation(srcIndex);
      let dstLoc = dstMap.offsetToLocation(dstIndex);

      // console.log(src, dst, srcLoc, dstLoc);

      let ms = mappings.find(
        m =>
          m.generatedColumn == dstLoc.column &&
          m.generatedLine == dstLoc.line &&
          m.originalColumn == srcLoc.column &&
          m.originalLine == srcLoc.line
      );

      expect(ms).not.toBe(undefined);
    });
  });
});
