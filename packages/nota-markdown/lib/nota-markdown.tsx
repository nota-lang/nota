import mdx from "@mdx-js/esbuild";
import esbuild from "esbuild";
import type estree from "estree";
import type hast from "hast";
import { generate } from "astring";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";
import { toText } from "hast-util-to-text";
import { math } from "micromark-extension-math";
import * as fromMarkdown from "mdast-util-from-markdown";
import { MDXJsxTextElement, MDXJsxFlowElement } from "mdast-util-mdx-jsx";

// function add_prelude() {
//   return (program: estree.Program, _) => {
//     console.log(generate(program));
//   //   let specifiers: estree.ImportSpecifier[] = PRELUDE.map(name => ({
//   //     type: "ImportSpecifier",
//   //     local: { type: "Identifier", name },
//   //     imported: { type: "Identifier", name },
//   //   }));

//   //   let prelude: estree.ImportDeclaration = {
//   //     type: "ImportDeclaration",
//   //     specifiers,
//   //     source: { type: "Literal", value: "@wcrichto/nota" },
//   //   };

//   //   program.body.unshift(prelude);

//   //   console.log(generate(prelude));
//   };
// }

function print_program() {
  return (program: estree.Program, _) => {
    // console.log(program);
    // console.log(generate(program));
  };
}

// function convert_math() {
//   return (root: hast.Root, _) => {
//     visit(root, "element", element => {
//       const classes =
//         element.properties && Array.isArray(element.properties.className)
//           ? element.properties.className
//           : [];
//       const inline = classes.includes("math-inline");
//       const displayMode = classes.includes("math-display");

//       if (!inline && !displayMode) {
//         return
//       }

//       const value = toText(element, {whitespace: 'pre'})
//       element.children =
//     });
//   };
// }

function mathFromMarkdown(): fromMarkdown.Extension {
  let enterMathFlow: fromMarkdown.Handle = function (token) {
    let element: MDXJsxFlowElement = {
      type: "mdxJsxFlowElement",
      name: "$$",
      attributes: [],
      children: [{ type: "text", value: "" }],
    };
    this.enter(element, token);
  };

  let enterMathFlowMeta: fromMarkdown.Handle = function () {
    this.buffer();
  };

  let exitMathFlowMeta: fromMarkdown.Handle = function () {
    const data = this.resume();
    const node = this.stack[this.stack.length - 1];
    // node.meta = data;
  };

  let exitMathFlowFence: fromMarkdown.Handle = function () {
    // Exit if this is the closing fence.
    if (this.getData("mathFlowInside")) return;
    this.buffer();
    this.setData("mathFlowInside", true);
  };

  let exitMathFlow: fromMarkdown.Handle = function (token) {
    const data = this.resume().replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "");
    const node = this.exit(token) as MDXJsxFlowElement;
    (node.children[0] as any).value = data;
    this.setData("mathFlowInside");
  };

  let enterMathText: fromMarkdown.Handle = function (token) {
    let element: MDXJsxTextElement = {
      type: "mdxJsxTextElement",
      name: "$",
      attributes: [],
      children: [{ type: "text", value: "" }],
    };
    this.enter(element, token);
    this.buffer();
  };

  let exitMathText: fromMarkdown.Handle = function (token) {
    const data = this.resume();
    const node = this.exit(token) as MDXJsxTextElement;
    (node.children[0] as any).value = data;
  };

  let exitMathData: fromMarkdown.Handle = function (token) {
    this.config.enter.data.call(this, token);
    this.config.exit.data.call(this, token);
  };

  return {
    enter: {
      mathFlow: enterMathFlow,
      mathFlowFenceMeta: enterMathFlowMeta,
      mathText: enterMathText,
    },
    exit: {
      mathFlow: exitMathFlow,
      mathFlowFence: exitMathFlowFence,
      mathFlowFenceMeta: exitMathFlowMeta,
      mathFlowValue: exitMathData,
      mathText: exitMathText,
      mathTextData: exitMathData,
    },
  };
}

function convert_math() {
  const data = this.data();
  data.micromarkExtensions.push(math());
  data.fromMarkdownExtensions.push(mathFromMarkdown());
}

export let notaMarkdown = (): esbuild.Plugin => {
  let mdx_plugin = mdx({
    remarkPlugins: [convert_math],
    recmaPlugins: [print_program],
  });

  return mdx_plugin;
};
