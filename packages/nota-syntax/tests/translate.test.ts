import type { BabelFileResult } from "@babel/core";
import * as babel from "@babel/standalone";
import type { Statement } from "@babel/types";
import type { SyntaxNode } from "@lezer/common";
import { resUnwrap } from "@nota-lang/nota-common/dist/result.js";
import parserBabel from "prettier/parser-babel";
import prettier from "prettier/standalone";
import { MappingItem, SourceMapConsumer } from "source-map";

import { mdTerms, tryParse } from "../dist/parse/mod.js";
import {
  LineMap,
  Translator,
  printTree,
  babelPolyfill as t,
  translate as trans,
} from "../dist/translate/mod.js";

test("translate end-to-end", () => {
  let input = `@h1: Hello world!`;
  let tree = resUnwrap(tryParse(input));
  let { code } = trans({ input, tree });
  let expected = `
import { createElement as el, Fragment } from "react";
import { observer } from "mobx-react";
import { document } from "@nota-lang/nota-components";
const {
  Document
} = document;
export default observer(docProps => el(Document, docProps, el("h1", {}, "Hello world!")));
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
      let result = babel.transformFromAst(program, undefined, {}) as any as BabelFileResult;
      return prettier.format(result.code!, { parser: "babel", plugins: [parserBabel] }).trimEnd();
    } catch (e) {
      console.error(input);
      throw e;
    }
  };

test("translate markdown inline", () => {
  let genInlineMarkdown = gen((translator, doc) => {
    let para = doc.getChild(mdTerms.Paragraph)!;
    let expr = translator.translateMdInline(para.firstChild!);
    return t.expressionStatement(expr);
  });

  let pairs = [
    [`**hello**`, `el("strong", {}, "hello");`],
    [`\`hello\``, `el("code", {}, "hello");`],
    [`*hello*`, `el("em", {}, "hello");`],
    [
      `[hello](world)`,
      `el(
  "a",
  {
    href: "world",
  },
  "hello"
);`,
    ],
    [`#x`, `x;`],
    [`#(Foo.bar)`, `Foo.bar;`],
    [`#f{a}{b}`, `f(["a"], ["b"]);`],
    [
      `#f{a}
             {b}`,
      `f(["a"], ["b"]);`,
    ],
    [`&foo`, `el(Ref, {}, "foo");`],
    [`&("foo")`, `el(Ref, {}, "foo");`],
    [`@foo{@bar}`, `el(foo, {}, el(bar, {}));`],
    [
      `<http://www.google.com>`,
      `el(
  "a",
  {
    href: "http://www.google.com",
  },
  "http://www.google.com"
);`,
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
    //     ["```\nhello\n```", `el(Listing, {}, "hello");`],
    //     [`> hello\n> world`, `el("blockquote", {}, el("p", {}, "hello\\n", null, " world"));`],
    //     [
    //       "* hello\n\n  yes\n* world",
    //       `el(
    //   "ul",
    //   {},
    //   el("li", {}, el("p", {}, "hello"), el("p", {}, "yes")),
    //   el("li", {}, el("p", {}, "world"))
    // );`,
    //     ],
    [
      `@em{**a**} @strong{b}`,
      `el("p", {}, el("em", {}, el("strong", {}, "a")), " ", el("strong", {}, "b"));`,
    ],
    [
      `@div[id: "foo"]: bar`,
      `el(
  "div",
  {
    id: "foo",
  },
  "bar"
);`,
    ],
    [`@outer{@inner{test}}`, `el("p", {}, el(outer, {}, el(inner, {}, "test")));`],
    [
      `Hello @em[id: "ex"]{world}`,
      `el(
  "p",
  {},
  "Hello ",
  el(
    "em",
    {
      id: "ex",
    },
    "world"
  )
);`,
    ],
    [`Hello @strong{world}`, `el("p", {}, "Hello ", el("strong", {}, "world"));`],
    [
      `@section:
  | id: "foo"
  Ceci n'est pas

  une code.`,
      `el(
  "section",
  {
    id: "foo",
  },
  ...[el("p", {}, "Ceci n'est pas"), el("p", {}, "une code.")]
);`,
    ],
    [
      `@h1:
  Hello

  @span:
    world
  
  @span: yed
 
p`,
      `el(
  "h1",
  {},
  ...[
    el("p", {}, "Hello"),
    el("span", {}, ...[el("p", {}, "world")]),
    el("span", {}, "yed"),
  ]
);`,
    ],
    [`$$\n#f{}\n\nx\n$$`, `el($$, {}, ...[f([]), "\\n\\nx"]);`],
    [`@{hey}`, `el("p", {}, ["hey"]);`],
    [`@span{hey}`, `el("p", {}, el("span", {}, "hey"));`],
    [`@span{a{b}c}d`, `el("p", {}, el("span", {}, "a{b}c"), "d");`],
    [
      `@foo[x: 1
    
+ 

2]`,
      `el(foo, {
  x: 1 + 2,
});`,
    ],
    [`foo // bar`, `el("p", {}, "foo ", null);`],
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

  let pairs = [
    [`@h1: a\n\n@h2: b`, `[el("h1", {}, "a"), el("h2", {}, "b")];`],
    [`@h1: a\n@h2: b`, `[el("h1", {}, "a"), el("h2", {}, "b")];`],
    [
      `%let x = 1\n\n#x`,
      `[
  ...(() => {
    let x = 1;
    return [null, el("p", {}, x)];
  })(),
];`,
    ],
    [
      `%let x = @em{**content**}\n#x`,
      `[
  ...(() => {
    let x = el("em", {}, el("strong", {}, "content"));
    return [null, el("p", {}, x)];
  })(),
];`,
    ],
    [
      `%let f = macro{**{#1}.{#2}**}\n#f{a}{b}`,
      `[
  ...(() => {
    let f = (...args) => ["**{", args[0], "}.{", args[1], "}**"];

    return [null, el("p", {}, f(["a"], ["b"]))];
  })(),
];`,
    ],
    [
      `%let f = ({x}) => @foo[attr: @bar{baz}]{#x}\n@f[x: "y"]`,
      `[
  ...(() => {
    let f = ({ x }) =>
      el(
        foo,
        {
          attr: el(bar, {}, "baz"),
        },
        x
      );

    return [
      null,
      el(f, {
        x: "y",
      }),
    ];
  })(),
];`,
    ],
    [`$$\n#f{}\n$$\n\nhello world`, `[el($$, {}, ...[f([])]), el("p", {}, "hello world")];`],
  ];

  pairs.forEach(([input, expected]) => {
    let actual = genDocMarkdown(input);
    expect(actual).toBe(expected);
  });
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
  Hello *world*!`;

  let tree = resUnwrap(tryParse(input));
  let { code, map } = trans({ input, tree, sourceRoot: ".", filenameRelative: "test.nota" });

  if (!code) {
    throw new Error("No code");
  }
  let lines = code!.split("\n");
  if (!map) {
    throw new Error("No source map");
  }

  let pairs = [
    ["@h1", `el("h1"`],
    ["*world*", `el("em"`],
  ];

  let srcMap = new LineMap(input);
  let dstMap = new LineMap(code);

  await SourceMapConsumer.with(map, null, consumer => {
    let mappings: MappingItem[] = [];
    consumer.eachMapping(m => {
      mappings.push(m);
    });

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
      let m = mappings.find(
        m =>
          m.generatedColumn == dstLoc.column &&
          m.generatedLine == dstLoc.line &&
          m.originalColumn == srcLoc.column &&
          m.originalLine == srcLoc.line
      );
      expect(m).not.toBe(undefined);
    });
  });
});
