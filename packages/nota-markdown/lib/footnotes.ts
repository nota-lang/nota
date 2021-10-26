import * as fromMarkdown from "mdast-util-from-markdown";
import { MDXJsxTextElement } from "mdast-util-mdx-jsx";
import { gfmFootnote } from "micromark-extension-gfm-footnote";
import type { Plugin } from "unified";

function gfmFootnoteFromMarkdown() {
  let enter_definition: fromMarkdown.Handle = function (token) {
    let element: MDXJsxTextElement = {
      type: "mdxJsxTextElement",
      name: "FootnoteDef",
      attributes: [],
      children: [],
    };
    this.enter(element, token);
  };

  let exit_definition: fromMarkdown.Handle = function (token) {
    this.exit(token);
  };

  let exit_definition_label: fromMarkdown.Handle = function (token) {
    const label = this.sliceSerialize(token);
    const el = this.stack[this.stack.length - 1] as MDXJsxTextElement;
    el.attributes.push({
      type: "mdxJsxAttribute",
      name: "name",
      value: label,
    });
  };

  return {
    enter: {
      gfmFootnoteDefinition: enter_definition,
    },
    exit: {
      gfmFootnoteDefinition: exit_definition,
      gfmFootnoteDefinitionLabelString: exit_definition_label,
    },
  };
}

export let footnotes_plugin: Plugin = function () {
  const data: Record<string, any> = this.data();
  data.micromarkExtensions.push(gfmFootnote());
  data.fromMarkdownExtensions.push(gfmFootnoteFromMarkdown());
};
