import {
  Completion,
  CompletionSource,
  snippetCompletion as snip, // completeFromList,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { SyntaxNode } from "@lezer/common";

// import COMPONENTS from "../translate/components.js";
import { INTRINSIC_ELEMENTS } from "../translate/intrinsic-elements.js";
import { jsTerms, mdTerms } from "./mod.js";

let notaElements = Object.keys({} /*COMPONENTS*/).filter(name => name[0].match(/[A-Z$]/) !== null);
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
let _snippets: Completion[] = [
  ["definition", `@Definition[name: \${name}]:\n\t| Label: \${label}\n\t\${definition}`],
].map(([label, snippet]) => snip(snippet, { label, type: "react" }));

let ident = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export let autocomplete: CompletionSource = context => {
  // let snippet = completeFromList(snippets)(context);
  // if (snippet) {
  //   console.log(snippet);
  //   return snippet;
  // }

  let text = (node: SyntaxNode) => context.state.doc.sliceString(node.from, node.to);
  let tree = syntaxTree(context.state);

  // TODO: collecting definitions on every autocomplete/keystroke seems expensive.
  // Factor this into a separate `ScopeAnalysis` extension or something?
  let definitions: Completion[] = [];
  tree.iterate({
    enter(node) {
      if (node.type.id == jsTerms.VariableDefinition) {
        definitions.push({
          label: text(node.node),
          type: "variable",
        });
        return false;
      } else {
        return true;
      }
    },
  });

  let nodeBefore = tree.resolveInner(context.pos, -1);
  let completions = new Map<number, Completion[]>([
    [mdTerms["@"], prelude],
    [mdTerms["HeaderMark"], definitions],
    [mdTerms["#"], definitions],
    [jsTerms["NotaTemplateCommand"], definitions],
  ]);
  let cmds = Array.from(completions.keys());

  let parent = nodeBefore.parent;

  // console.log(nodeBefore.name, parent?.name);

  // User has just typed "@"
  if (cmds.includes(nodeBefore.type.id)) {
    return {
      from: context.pos,
      options: completions.get(nodeBefore.type.id)!,
      validFor: ident,
    };
  }
  // User is typing "@cmd"
  else if (parent && parent.type.id == mdTerms.NotaCommandName) {
    return {
      from: nodeBefore.from,
      options: completions.get(parent.prevSibling!.type.id)!,
      validFor: ident,
    };
  }

  return null;
};
