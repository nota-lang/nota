import { SyntaxNode, Tree } from "@lezer/common";
import * as t from "./babel-polyfill";
//@ts-ignore
import * as terms from "./nota.terms";
import _, { transform } from "lodash";
import type { Expression, LVal, SpreadElement } from "@babel/types";
import { transformFromAst } from "@babel/standalone";
import * as nota from "@wcrichto/nota";
import { INTRINSIC_ELEMENTS } from "./intrinsic-elements";

const assert = console.assert;

let matches = (node: SyntaxNode, term: number): boolean => node.type.id == term;
let matches_newline = (node: SyntaxNode): boolean =>
  matches(node, terms.Newline) || matches(node, terms.Multinewline);

let global: {
  input: string;
  used_prelude: Set<string>;
  imports: Set<string>;
} = {
  input: "",
  used_prelude: new Set(),
  imports: new Set(),
};

let react_id = t.identifier("React");
let globals_arg = t.identifier("globals");
let imports_arg = t.identifier("imports");
let create_el = t.identifier("el");

let to_react = (
  name: Expression,
  props: { [key: string]: Expression },
  children: (Expression | SpreadElement)[]
): Expression => {
  let args: (Expression | SpreadElement)[] = [
    name,
    t.objectExpression(Object.keys(props).map(k => t.objectProperty(t.stringLiteral(k), props[k]))),
  ];
  return t.callExpression(create_el, args.concat(children));
};

let text = (cursor: SyntaxNode): string => global.input.slice(cursor.from, cursor.to);

export type TranslatedFunction = (
  _symbols: { [key: string]: any },
  _imports: { [path: string]: any }
) => JSX.Element;

export interface Translation {
  js: string;
  imports: Set<string>;
}

export let PRELUDE: Set<string> = new Set(Object.keys(nota));

export let translate = async (input: string, tree: Tree): Promise<Translation> => {
  let node = tree.topNode;
  assert(matches(node, terms.Top));
  global = {
    input,
    used_prelude: new Set(["Document"]),
    imports: new Set(),
  };

  let doc_body = translate_textbody(node.firstChild!);
  let doc = to_react(t.identifier("Document"), {}, doc_body);

  let binding = (k: LVal, v: Expression) =>
    t.variableDeclaration("let", [t.variableDeclarator(k, v)]);

  let block = t.blockStatement([
    binding(
      t.objectPattern(
        Array.from(global.used_prelude).map(k =>
          t.objectProperty(t.identifier(k), t.identifier(k), true)
        )
      ),
      globals_arg
    ),
    binding(react_id, t.memberExpression(globals_arg, react_id)),
    binding(create_el, t.memberExpression(react_id, t.identifier("createElement"))),
    t.returnStatement(doc),
  ]);

  let fn = t.arrowFunctionExpression([globals_arg, imports_arg], block);
  let program = t.program([t.expressionStatement(fn)]);
  let result: any = transformFromAst(program, undefined, {});
  let js = result.code.slice(0, -1);

  return { js, imports: global.imports };
};

let translate_textbody = (node: SyntaxNode): Expression[] => {
  assert(matches(node, terms.TextBody));

  let tokens = node.getChildren(terms.TextToken);

  // Remove whitespace on the last line
  let last = _.last(tokens);
  if (last && matches(last.firstChild!, terms.Text)) {
    let s = text(last);
    if (s.match(/^[\s]*$/)) {
      tokens.pop();
    }
  }

  // Remove leading whitespace
  let line_starts = tokens
    .map((_t, i) => i)
    .filter(i => {
      let line_start = i > 0 && matches_newline(tokens[i - 1].firstChild!);
      return line_start && matches(tokens[i].firstChild!, terms.Text);
    });

  let min_leading_whitespace =
    line_starts.length > 0
      ? line_starts
          .map(i => {
            let s = text(tokens[i]);
            return s.match(/^( )*/)![0].length;
          })
          .reduce((a, b) => Math.min(a, b))
      : 0;

  let children = tokens.reduce<Expression[]>((output, token, i) => {
    if (line_starts.includes(i)) {
      let stripped = text(token).slice(min_leading_whitespace);
      if (stripped.length > 0) {
        output.push(t.stringLiteral(stripped));
      }
    } else if (matches_newline(token.firstChild!) && (i == 0 || i == tokens.length - 1)) {
      // pass
    } else {
      output.push(translate_token(token));
    }
    return output;
  }, []);

  return children;
};

let translate_token = (node: SyntaxNode): Expression => {
  assert(matches(node, terms.TextToken));

  let child = node.firstChild!;
  if (matches(child, terms.Command)) {
    return translate_command(child);
  } else if (matches(child, terms.Text)) {
    return t.stringLiteral(text(child));
  } else if (matches(child, terms.Newline)) {
    return t.stringLiteral("\n");
  } else if (matches(child, terms.Multinewline)) {
    return t.stringLiteral("\n\n");
  } else {
    throw `Unhandled child type ${child.name}`;
  }
};

let translate_command = (node: SyntaxNode): Expression => {
  assert(matches(node, terms.Command));

  let sigil = text(node.getChild(terms.CommandSigil)!);
  let name = text(node.getChild(terms.CommandName)!);
  if (PRELUDE.has(name)) {
    global.used_prelude.add(name);
  }

  let named_args = node.getChildren(terms.CommandNamedArg);
  let anon_args = node
    .getChildren(terms.CommandAnonArg)
    .map(node => {
      let child = node.firstChild!;
      if (child.type.id == terms.TextBody) {
        return translate_textbody(node.firstChild!);
      } else if (child.type.id == terms.VerbatimText) {
        return [t.stringLiteral(text(child))];
      } else {
        throw `Unknown CommandAnonArg ${child.name}`;
      }
    })
    .map(exprs => t.arrayExpression(exprs));

  if (sigil == "@") {
    return to_react(
      INTRINSIC_ELEMENTS.has(name) ? t.stringLiteral(name) : t.identifier(name),
      {},
      anon_args.map(arr => t.spreadElement(arr))
    );
  } else if (sigil == "#") {
    if (name == "import") {
      global.imports.add(text(node.getChildren(terms.CommandAnonArg)[0].firstChild!));
    }

    return t.callExpression(t.identifier(name), anon_args);
  } else if (sigil == "%") {
    throw `nope`;
  } else {
    throw `Unhandled sigil ${sigil}`;
  }
};
