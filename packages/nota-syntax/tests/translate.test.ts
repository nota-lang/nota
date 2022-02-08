import type { Expression, Statement } from "@babel/types";
import type { SyntaxNode } from "@lezer/common";
import { is_left, res_unwrap } from "@nota-lang/nota-common";
import * as babel from "@babel/standalone";
import type { BabelFileResult } from "@babel/core";
import {
  try_parse,
  translate,
  Translator,
  babel_polyfill as t,
  terms,
} from "@nota-lang/nota-syntax";

test("translate", () => {
  let input = "@h1{Hello world!}";
  let tree = res_unwrap(try_parse(input));
  let js = translate(input, tree);
  let expected = `
import { createElement as el, Fragment } from "react";
import { observer } from "mobx-react";
import { Document } from "@nota-lang/nota-components";
export default observer(doc_props => el(Document, { ...doc_props
}, el("h1", {}, "Hello world!")));
  `;
  expect(js).toBe(expected.trim());
});

let gen =
  (f: (_tr: Translator, _node: SyntaxNode) => Statement) =>
  (input: string): string => {
    try {
      let tree = res_unwrap(try_parse(input));
      let translator = new Translator(input);
      let stmt = f(translator, tree.topNode);
      let program = t.program([stmt]);
      let result = babel.transformFromAst(program, undefined, {}) as any as BabelFileResult;
      return result.code;
    } catch (e) {
      console.error(input);
      throw e;
    }
  };

test("translate textbody", () => {
  let gen_textbody = gen((translator, node) => {
    let textbody = node.getChild(terms.TextBody)!;
    let expr = translator.translate_textbody(textbody);
    return t.expressionStatement(expr);
  });

  let pairs = [
    [`a b c`, `["a b c"];`],
    [`a\n\nb\nc`, `["a", "\\n", "\\n", "b", "\\n", "c"];`],
    [`@h1{hello}`, `[el("h1", {}, ...["hello"])];`],
  ];

  pairs.forEach(([input, expected]) => {
    let actual = gen_textbody(input);
    expect(actual).toBe(expected);
  });
});

test("translate command", () => {
  let gen_command = gen((translator, node) => {
    let cmd = node.getChild(terms.TextBody)!.getChild(terms.TextToken)!.getChild(terms.Command)!;
    let result = translator.translate_command(cmd);
    if (is_left(result)) {
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
    let actual = gen_command(input);
    expect(actual).toBe(expected);
  });
});
