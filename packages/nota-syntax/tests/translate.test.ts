import type { BabelFileResult } from "@babel/core";
import * as babel from "@babel/standalone";
import type { Statement } from "@babel/types";
import type { SyntaxNode } from "@lezer/common";
import { resUnwrap } from "@nota-lang/nota-common/dist/result.js";
import _ from "lodash";
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
export default observer(function TheDocument(docProps) {
  return el(Document, docProps, el("h1", {}, "Hello world!"));
});`;
  expect(code).toBe(expected.trim());
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
      let result = babel.transformFromAst(program, undefined, {
        plugins: [optimizePlugin],
      }) as any as BabelFileResult;
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
    [r`$\Theta$`, r`el($, {}, "\\Theta");`],
    [`#{foo #bar}`, `[["foo ", bar]];`],
    [`#(@{sup})`, `el(Fragment, {}, "sup");`],
    [`#(#{a #b{c} d})`, `[["a ", b(["c"]), " d"]];`],
    [`#(@\${hey})`, `el($, {}, "hey");`],
    [
      `$#a
  {b}$`,
      `el($, {}, a(["b"]));`,
    ],
  ];

  pairs.forEach(([input, expected]) => {
    let actual = genInlineMarkdown(input);
    expect(actual).toBe(expected);
  });
});

// TODO:
//  - dedent block attributes (pipe is aligned with @)
//  - allow block attribute keys to be prefixed with @ to assume
//    that markdown content follows

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
    // basic markdown
    [`# hello`, `el("h1", {}, " hello");`],
    [`## hello`, `el("h2", {}, " hello");`],
    ["```\nhello\n```", `el(Listing, {}, "hello");`],
    [`> hello\n> world`, `el("blockquote", {}, el("p", {}, "hello\\n", null, " world"));`],
    [
      "* hello\n\n  yes\n* world",
      `el(
  "ul",
  {},
  el("li", {}, el("p", {}, "hello"), el("p", {}, "yes")),
  el("li", {}, el("p", {}, "world"))
);`,
    ],

    // markdown extensions
    [`$$\n#f{}\n\nx\n$$`, `el($$, {}, f([]), "\\n\\nx");`],
    [`foo // bar`, `el("p", {}, "foo ", null);`],

    // curly-brace components
    [`@foo{bar}`, `el(foo, {}, "bar");`],
    [
      `@em{**a**} @strong{b}`,
      `el("p", {}, el("em", {}, el("strong", {}, "a")), " ", el("strong", {}, "b"));`,
    ],
    [`@\${\\Theta}`, r`el($, {}, "\\Theta");`],
    [`@outer{@inner{test}}`, `el(outer, {}, el(inner, {}, "test"));`],
    [`@{hey}`, `el(Fragment, {}, "hey");`],
    [`@span{hey}`, `el("span", {}, "hey");`],
    [`@span{a{b}c}d`, `el("p", {}, el("span", {}, "a{b}c"), "d");`],
    [`Hello @strong{world}`, `el("p", {}, "Hello ", el("strong", {}, "world"));`],

    // block components
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
    [
      `@foo:
  @bar:
    @baz:
      x`,
      `el(foo, {}, el(bar, {}, el(baz, {}, "x")));`,
    ],
    [
      `@lorem:
  | ipsum: dolor
    sit
  amet

  consectetur`,
      `el(
  lorem,
  {
    ipsum: el(Fragment, {}, "dolor", "sit"),
  },
  el("p", {}, "amet"),
  el("p", {}, "consectetur")
);`,
    ],
    [
      `@h1:
  Hello

  @span:
    world
  
  @span: yed

not-in-block`,
      `el(
  "h1",
  {},
  el("p", {}, "Hello"),
  el("span", {}, "world"),
  el("span", {}, "yed")
);`,
    ],
    [
      `@foo[x: 1
    
+ 

2]`,
      `el(foo, {
  x: 1 + 2,
});`,
    ],
    [
      `@foo:
  | bar:
    $$
    baz
    $$`,
      `el(foo, {
  bar: el(Fragment, {}, el($$, {}, "baz")),
});`,
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
    [`$$\n#f{}\n$$\n\nhello world`, `[el($$, {}, f([])), el("p", {}, "hello world")];`],
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
  Hello *world*! #yep{}`;

  let tree = resUnwrap(tryParse(input));
  let { code, map } = trans({ input, tree, sourceRoot: ".", filenameRelative: "test.nota" });
  // console.log(code);

  if (!code) throw new Error("No code");
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
