import { syntaxTree } from "@codemirror/language";
import { CompletionSource, Completion } from "@codemirror/autocomplete";
import { SyntaxNode } from "@lezer/common";

import { INTRINSIC_ELEMENTS } from "../intrinsic-elements";
//@ts-ignore
import * as terms from "./nota.grammar";
//@ts-ignore
import * as js_terms from "../javascript/javascript.grammar";

// TODO: determine which Nota exports are React elements vs. functions
let prelude = Array.from(INTRINSIC_ELEMENTS)
  .map(label => ({ label, type: "function", boost: -1 }))
  .concat(
    ["$", "$$", "Section", "Subsection", "Title"].map(label => ({
      label,
      type: "function",
      boost: 1,
    }))
  );

let pct_completions: Completion[] = ["let", "letfn", "import", "import_default"].map(
  (label, i) => ({
    label,
    type: "keyword",
    boost: -i,
  })
);

let ident = /^[a-zA-Z_\$][a-zA-Z0-9_\$]*$/;

export let autocomplete: CompletionSource = context => {
  let text = (node: SyntaxNode) => context.state.doc.sliceString(node.from, node.to);
  let tree = syntaxTree(context.state);

  // TODO: collecting definitions on every autocomplete/keystroke seems expensive.
  // Factor this into a separate `ScopeAnalysis` extension or something?
  let definitions: Completion[] = [];
  tree.iterate({
    enter(type, _from, _to, get) {
      if (type.id == terms.PctCommand && type.name == "PctCommand" && get().getChild(terms.Ident)) {
        let node = get();
        let name = text(node.getChild(terms.Ident)!);
        if ((name == "let" || name == "letfn") && node.getChild(terms.ArgCodeAnon)) {
          definitions.push({
            label: text(node.getChild(terms.ArgCodeAnon)!.getChild(js_terms.Script)!),
            type: name == "let" ? "variable" : "function",
          });
        }
        return false;
      }
    },
  });

  let node_before = tree.resolveInner(context.pos, -1);
  let completions = new Map<number, Completion[]>([
    [terms.AtCommand, prelude],
    [terms.PctCommand, pct_completions],
    [terms.HashCommand, definitions],
  ]);
  let cmds = Array.from(completions.keys());

  let parent = node_before.parent;
  // User has just typed "@"
  if (cmds.includes(node_before.type.id)) {
    return {
      from: node_before.to,
      options: completions.get(node_before.type.id)!,
      span: ident,
    };
  } // User is typing "@cmd"
  else if (
    parent &&
    (parent.type.id == terms.CommandName || parent.type.id == terms.Ident) &&
    parent.parent &&
    cmds.includes(parent.parent.type.id)
  ) {
    return {
      from: node_before.from,
      options: completions.get(parent.parent.type.id)!,
      span: ident,
    };
  }
  return null;
};
