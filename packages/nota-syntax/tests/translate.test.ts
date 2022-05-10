import type { BabelFileResult } from "@babel/core";
import * as babel from "@babel/standalone";
import type { Expression, Statement } from "@babel/types";
import type { SyntaxNode } from "@lezer/common";
import { resUnwrap } from "@nota-lang/nota-common/dist/result.js";
import { isLeft } from "@nota-lang/nota-common/dist/either.js";
import { Translator, babelPolyfill as t, terms, translate, tryParse } from "..";

test("translate", () => {
  let input = "@h1{Hello world!}";
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

test("translate textbody", () => {
  let genTextbody = gen((translator, node) => {
    let textbody = node.getChild(terms.TextBody)!;
    let expr = translator.translateTextbody(textbody);
    return t.expressionStatement(expr);
  });

  let pairs = [
    [`a b c`, `["a b c"];`],
    [`a\n\nb\nc`, `["a", "\\n", "\\n", "b", "\\n", "c"];`],
    [`@h1{hello}`, `[el("h1", {}, ...["hello"])];`],
  ];

  pairs.forEach(([input, expected]) => {
    let actual = genTextbody(input);
    expect(actual).toBe(expected);
  });
});

test("translate command", () => {
  let genCommand = gen((translator, node) => {
    let cmd = node.getChild(terms.TextBody)!.getChild(terms.TextToken)!.getChild(terms.Command)!;
    let result = translator.translateCommand(cmd);
    if (isLeft(result)) {
      return t.expressionStatement(result.value);
    } else {
      return t.blockStatement(result.value);
    }
  });

  let pairs = [
    [`@h1{hello}`, `el("h1", {}, ...["hello"]);`],
    [
      `@a[href="https://yeah.com"]{das link}`,
      `el("a", {
  href: "https://yeah.com"
}, ...["das link"]);`,
    ],
    [`@Custom`, `el(Custom, {});`],
    [`@(A.field)`, `el(A.field, {});`],
    [`#(1 + 2)`, `1 + 2;`],
    [`#x`, `x;`],
    [`#f{hello}`, `f(["hello"]);`],
    [`#f[a]{b}["c"]{d}`, `f(a, ["b"], "c", ["d"]);`],
  ];

  pairs.forEach(([input, expected]) => {
    let actual = genCommand(input);
    expect(actual).toBe(expected);
  });
});
