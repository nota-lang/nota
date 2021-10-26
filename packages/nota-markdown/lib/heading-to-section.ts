import find from "unist-util-find";
import type { MDXJsxAttribute, MDXJsxFlowElement } from "mdast-util-mdx-jsx";
import type mdast from "mdast";
import _ from "lodash";
import type {Plugin} from 'unified';

export let heading_to_section_plugin: Plugin<any[], mdast.Root> = function() {
  return (tree, _file) => {
    let doc = find(tree, { name: "Document" }) as MDXJsxFlowElement | undefined;
    if (!doc) {
      throw "Could not find document";
    }

    let new_doc: mdast.BlockContent[] = [];
    let section_stack: MDXJsxFlowElement[] = [];
    
    doc.children.forEach(child => {
      if (child.type == "heading") {
        // if at level A and receive heading at level B <= A, then need to
        // flush all headings at depths in the interval [B, A]
        let popped = section_stack.splice(child.depth - 1);
        if (section_stack.length == 0 && popped.length > 0) {
          new_doc.push(popped[0]);
        }

        let title: MDXJsxFlowElement = {
          type: "mdxJsxFlowElement",
          name: "SectionTitle",
          attributes: [],
          children: child.children as any
        };

        let label: string | undefined = (child as any).label;
        let attributes: MDXJsxAttribute[] = label
          ? [
              {
                type: "mdxJsxAttribute",
                name: "name",
                value: label,
              },
            ]
          : [];
        let section: MDXJsxFlowElement = {
          type: "mdxJsxFlowElement",
          name: "Section",
          attributes,
          children: [title],
        };

        if (section_stack.length > 0) {
          _.last(section_stack)!.children.push(section);
        }

        section_stack.push(section);
      } else {
        if (section_stack.length == 0) {
          new_doc.push(child);
        } else {
          _.last(section_stack)!.children.push(child);
        }
      }
    });

    if (section_stack.length > 0) {
      new_doc.push(section_stack[0]);
    }

    doc.children = new_doc;
  };
}
