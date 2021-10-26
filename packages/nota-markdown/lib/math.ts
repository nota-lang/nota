import { math } from "micromark-extension-math";
import * as fromMarkdown from "mdast-util-from-markdown";
import { MDXJsxTextElement, MDXJsxFlowElement } from "mdast-util-mdx-jsx";

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

export default function() {
  const data = this.data();
  data.micromarkExtensions.push(math());
  data.fromMarkdownExtensions.push(mathFromMarkdown());
}
