import * as fromMarkdown from "mdast-util-from-markdown";
import { MDXJsxTextElement, MDXJsxFlowElement } from "mdast-util-mdx-jsx";
import { gfmFootnote } from "micromark-extension-gfm-footnote";

function gfmFootnoteFromMarkdown() {
  // let enterGfmFootnoteCall: fromMarkdown.Handle = function (token) {
  //   this.buffer();
  // };

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

  let enter_definition_label: fromMarkdown.Handle = function(token) {
    this.buffer();
  };

  let exit_definition_label: fromMarkdown.Handle = function(token) {
    const label = this.resume();
    const el = this.stack[this.stack.length - 1] as MDXJsxTextElement;
    el.attributes.push({
      type: "mdxJsxAttribute",
      name: "name",
      value: label
    });
  };

  return {
    enter: {
      gfmFootnoteDefinition: enter_definition,
      gfmFootnoteDefinitionLabelString: enter_definition_label,
    },
    exit: {
      gfmFootnoteDefinition: exit_definition,
      gfmFootnoteDefinitionLabelString: exit_definition_label,
    },
  };
}


export default function() {
  const data = this.data();
  data.micromarkExtensions.push(gfmFootnote());
  data.fromMarkdownExtensions.push(gfmFootnoteFromMarkdown());
}