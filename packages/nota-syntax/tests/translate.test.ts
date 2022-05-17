import type { BabelFileResult } from "@babel/core";
import * as babel from "@babel/standalone";
import type { Statement } from "@babel/types";
import type { SyntaxNode } from "@lezer/common";
import { resUnwrap } from "@nota-lang/nota-common/dist/result.js";
import { optUnwrap } from "@nota-lang/nota-common/dist/option.js";
import { isLeft } from "@nota-lang/nota-common/dist/either.js";
import { Translator, printTree, babelPolyfill as t, terms, translate, tryParse, MdTerms } from "..";

test("translate end-to-end", () => {
  let input = `@em{**hello** world}`;
  let tree = resUnwrap(tryParse(input));
  let js = translate(input, tree);
  let expected = `
import { createElement as el, Fragment } from "react";
import { observer } from "mobx-react";
import { document } from "@nota-lang/nota-components";
const {
  Document
} = document;
export default observer(docProps => el(Document, docProps, el("h1", {}, "Hello world!")));
  `;
  expect(js).toBe(expected.trim());
});

let gen =
  (f: (tr: Translator, node: SyntaxNode) => Statement) =>
  (input: string): string => {
    try {
      let tree = resUnwrap(tryParse(input));
      printTree(tree, input);
      let translator = new Translator(input);
      let stmt = f(translator, tree.topNode);
      let program = t.program([stmt]);
      let result = babel.transformFromAst(program, undefined, {}) as any as BabelFileResult;
      return result.code!;
    } catch (e) {
      console.error(input);
      throw e;
    }
  };

test("translate markdown inline", () => {
  let genInlineMarkdown = gen((translator, doc) => {
    let para = doc.getChild(MdTerms.Paragraph)!;
    let [expr] = translator.translateMdInline(para.firstChild!);
    return t.expressionStatement(optUnwrap(expr));
  });

  let pairs = [
    [`**hello**`, `el("strong", {}, "hello");`],
    [`\`hello\``, `el("code", {}, "hello");`],
    [`*hello*`, `el("em", {}, "hello");`],
    [
      `[hello](world)`,
      `el("a", {
  "href": "world"
}, "hello");`,
    ],
  ];

  pairs.forEach(([input, expected]) => {
    let actual = genInlineMarkdown(input);
    expect(actual).toBe(expected);
  });
});

test("translate markdown block", () => {
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

  let pairs = [
    //     [`# hello`, `el("h1", {}, " hello");`],
    //     [`## hello`, `el("h2", {}, " hello");`],
    //     ["```\nhello\n```", `el("pre", {}, "hello");`],
    //     [
    //       `> hello
    // > world`,
    //       `el("blockquote", {}, el("p", {}, "hello\\n", " world"));`,
    //     ],
    //     [
    //       "* hello\n\n  yes\n* world",
    //       `el("ul", {}, el("li", {}, el("p", {}, "hello"), el("p", {}, "yes")), el("li", {}, el("p", {}, "world")));`,
    //     ],
    //     [
    //       `@em{**a**} @strong{b}`,
    //       `el("p", {}, el("em", {}, ...[el("strong", {}, "a")]), " ", el("strong", {}, ...["b"]));`,
    //     ],
    // [`%let x = 1`, ``],
    [`%%%
let x = 1;
let y = 2;
%%%`, ``],
    [`@h1: Hello *world*`, ``],
    [
      `@section:
  | id: "foo"
  | onClick:
    () => {
      console.log("heyo!")
    }
  Ceci n'est pas

  une code.`,
      `el("section", {"id": "foo"}, ...[el("p", {}, "Ceci n'est pas"), el("p", {}, "une code.")a])`,
    ],
  ];

  pairs.forEach(([input, expected]) => {
    let actual = genBlockMarkdown(input);
    expect(actual).toBe(expected);
  });
});

test("translate markdown doc", () => {
  let genDocMarkdown = gen((translator, doc) => {
    let expr = translator.translateMdDocument(doc);
    return t.expressionStatement(expr);
  });

  let pairs = [[`@h1{a}\n\n@h2{b}`, `[el("h1", {}, ...["a"]), el("h2", {}, ...["b"])];`]];

  pairs.forEach(([input, expected]) => {
    let actual = genDocMarkdown(input);
    expect(actual).toBe(expected);
  });
});

test("translate command", () => {
  let genCommand = gen((translator, node) => {
    let cmd = node.getChild(MdTerms.Paragraph)!.getChild(terms.Command)!;
    let result = translator.translateCommand(cmd);
    if (isLeft(result)) {
      return t.expressionStatement(result.value);
    } else {
      return t.blockStatement(result.value);
    }
  });

  let pairs = [
    [`Hello @strong: wor*ld*`, ``],
    [`Hello @strong{world, *yeah!*}`, `el("h1", {}, ...["hello"]);`],
//     [
//       `@a[href="https://yeah.com"]{das link}`,
//       `el("a", {
//   href: "https://yeah.com"
// }, ...["das link"]);`,
//     ],
//     [`@Custom`, `el(Custom, {});`],
//     [`@(A.field)`, `el(A.field, {});`],
//     [`#(1 + 2)`, `1 + 2;`],
//     [`#x`, `x;`],
//     [`#f{hello}`, `f(["hello"]);`],
//     [`#f[a]{b}["c"]{d}`, `f(a, ["b"], "c", ["d"]);`],
//     [
//       `%(let x = 1)`,
//       `{
//   let x = 1;
// }`,
//     ],
  ];

  pairs.forEach(([input, expected]) => {
    let actual = genCommand(input);
    expect(actual).toBe(expected);
  });
});
