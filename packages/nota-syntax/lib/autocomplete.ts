import {
  Completion,
  CompletionSource,
  snippetCompletion as snip, // completeFromList,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { SyntaxNode } from "@lezer/common";

import { INTRINSIC_ELEMENTS } from "./intrinsic-elements";
//@ts-ignore
import * as terms from "./nota.grammar";

//@ts-ignore
let components: string[] = COMPONENTS;
let notaElements = components.filter(name => name[0].match(/[A-Z$]/) !== null);
let prelude: Completion[] = Array.from(INTRINSIC_ELEMENTS)
  .map(label => ({ label, type: "react", boost: -1 }))
  .concat(
    notaElements.reverse().map((label, i) => ({
      label,
      type: "react",
      boost: i,
    }))
  );

// TODO: not working, figure out how snippets work
let _snippets: Completion[] = [["list", "@ol{\n\t@li{}\n}"]].map(([label, snippet]) =>
  snip(snippet, { label, type: "react" })
);

let ident = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export let autocomplete: CompletionSource = context => {
  // let snippet = completeFromList(snippets)(context);
  // if (snippet) {
  //   return snippet;
  // }

  let text = (node: SyntaxNode) => context.state.doc.sliceString(node.from, node.to);
  let tree = syntaxTree(context.state);

  // TODO: collecting definitions on every autocomplete/keystroke seems expensive.
  // Factor this into a separate `ScopeAnalysis` extension or something?
  let definitions: Completion[] = [];
  tree.iterate({
    enter(type, _from, _to, get) {
      if (type.id == terms.VariableDefinition) {
        definitions.push({
          label: text(get()),
          type: "variable",
        });
        return false;
      }
    },
  });

  let nodeBefore = tree.resolveInner(context.pos, -1);
  let completions = new Map<number, Completion[]>([
    [terms.AtCommand, prelude],
    [terms.HashCommand, definitions],
  ]);
  let cmds = Array.from(completions.keys());

  let parent = nodeBefore.parent;

  // User has just typed "@"
  if (cmds.includes(nodeBefore.type.id)) {
    return {
      from: context.pos,
      options: completions.get(nodeBefore.type.id)!,
      span: ident,
    };
  } // User is typing "@cmd"
  else if (
    parent &&
    (parent.type.id == terms.CommandName || parent.type.id == terms.VariableName) &&
    parent.parent &&
    cmds.includes(parent.parent.type.id)
  ) {
    return {
      from: nodeBefore.from,
      options: completions.get(parent.parent.type.id)!,
      span: ident,
    };
  }
  return null;
};
