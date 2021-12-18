import { SyntaxNode, Tree } from "@lezer/common";
import _ from "lodash";
import type {
  Expression,
  Statement,
  LVal,
  SpreadElement,
  ExpressionStatement,
  ImportDeclaration,
  Identifier,
  StringLiteral,
} from "@babel/types";
import type { PluginObj, BabelFileResult } from "@babel/core";
import * as babel from "@babel/standalone";
import * as nota from "@wcrichto/nota-components";
import { Either, left, right, is_left, assert, unreachable } from "@wcrichto/nota-common";

import * as t from "../babel-polyfill";
//@ts-ignore
import * as terms from "./nota.grammar";
//@ts-ignore
import * as js_terms from "../javascript/javascript.grammar";
import { INTRINSIC_ELEMENTS } from "../intrinsic-elements";
import { translate_js } from "../javascript/translate";

export let matches = (node: SyntaxNode, term: number): boolean => node.type.id == term;
let matches_newline = (node: SyntaxNode): boolean =>
  matches(node, terms.Newline) || matches(node, terms.Multinewline);

let global: {
  input: string;
  imports: Set<ImportDeclaration>;
} = {
  input: "",
  imports: new Set(),
};

let create_el = t.identifier("el");
let arguments_id = t.identifier("args");

let to_react = (
  name: Expression,
  props: [Expression, Expression][],
  children: (Expression | SpreadElement)[]
): Expression => {
  let args: (Expression | SpreadElement)[] = [
    name,
    t.objectExpression(props.map(([k, v]) => t.objectProperty(k, v))),
  ];
  return t.callExpression(create_el, args.concat(children));
};

export let text = (cursor: SyntaxNode): string => global.input.slice(cursor.from, cursor.to);

export type TranslatedFunction = (
  _symbols: { [key: string]: any },
  _imports: { [path: string]: any }
) => JSX.Element;

export interface Translation {
  js: string;
  imports: Set<string>;
}

let binding = (k: LVal, v: Expression) =>
  t.variableDeclaration("let", [t.variableDeclarator(k, v)]);

let optimize_plugin: PluginObj = {
  visitor: {
    CallExpression(path) {
      path.node.arguments = path.node.arguments
        .map(arg => {
          if (arg.type == "SpreadElement" && arg.argument.type == "ArrayExpression") {
            return arg.argument.elements.map(el => el!);
          } else {
            return [arg];
          }
        })
        .flat();
    },
  },
};

let parse = (code: string): Statement[] => {
  let result = babel.transform(code, {
    ast: true,
  }) as any as BabelFileResult;
  return result.ast!.program.body;
};

export let parse_expr = (code: string): Expression => {
  let s = parse(`(${code});`)[0] as ExpressionStatement;
  return s.expression;
};

export let lambda = (body: Expression) =>
  t.arrowFunctionExpression([t.restElement(arguments_id)], body);

export let translate = (input: string, tree: Tree): string => {
  let node = tree.topNode;
  assert(matches(node, terms.Document));
  global = {
    input,
    imports: new Set(),
  };

  let doc_body = translate_textbody(node.firstChild!);
  let doc = to_react(t.identifier("Document"), [], [t.spreadElement(doc_body)]);

  let create_el_long = t.identifier("createElement");
  let program = [
    t.importDeclaration(
      [t.importSpecifier(create_el_long, create_el_long)],
      t.stringLiteral("react")
    ),
    t.importDeclaration(
      Object.keys(nota).map(k => t.importSpecifier(t.identifier(k), t.identifier(k))),
      t.stringLiteral("@wcrichto/nota-components")
    ),
    ...Array.from(global.imports),
    binding(create_el, create_el_long),
    t.exportDefaultDeclaration(doc),
  ];

  let result = babel.transformFromAst(t.program(program), undefined, {
    plugins: [() => optimize_plugin],
  }) as any as BabelFileResult;
  let js = result.code!;

  return js;
};

export let translate_textbody = (node: SyntaxNode): Expression => {
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

  let output: Either<Expression, Statement | null>[] = [];
  tokens.forEach((token, i) => {
    if (line_starts.includes(i)) {
      let stripped = text(token).slice(min_leading_whitespace);
      if (stripped.length > 0) {
        output.push(left(process_text(stripped)));
      }
    } else if (matches_newline(token.firstChild!) && (i == 0 || i == tokens.length - 1)) {
      // pass
    } else {
      output.push(translate_token(token));
    }
  });

  let array: (Expression | SpreadElement)[] = [];
  let cur_array = array;
  output.forEach(result => {
    if (is_left(result)) {
      cur_array.push(result.value);
    } else if (result.value != null) {
      let new_array: (Expression | SpreadElement)[] = [];
      let body = t.blockStatement([result.value, t.returnStatement(t.arrayExpression(new_array))]);
      let fn = t.spreadElement(t.callExpression(t.arrowFunctionExpression([], body), []));
      cur_array.push(fn);
      cur_array = new_array;
    }
  });

  return t.arrayExpression(array);
};

type TranslatedToken = Either<Expression, Statement | null>;

let process_text = (text: string): StringLiteral => {
  return t.stringLiteral(text.replace(/\\%/g, "%"));
};

let translate_token = (node: SyntaxNode): TranslatedToken => {
  assert(matches(node, terms.TextToken));

  let child = node.firstChild!;
  if (matches(child, terms.Command)) {
    return translate_command(child);
  } else if (matches(child, terms.Text)) {
    return left(process_text(text(child)));
  } else if (matches(child, terms.Newline)) {
    return left(t.stringLiteral("\n"));
  } else if (matches(child, terms.Multinewline)) {
    return left(t.stringLiteral("\n\n"));
  } else {
    throw `Unhandled child type ${child.name}`;
  }
};

let translate_command = (node: SyntaxNode): TranslatedToken => {
  assert(matches(node, terms.Command));

  let child = node.firstChild!;
  if (matches(child, terms.PctCommand)) {
    return right(translate_pctcommand(child));
  } else if (matches(child, terms.HashCommand)) {
    return left(translate_hashcommand(child));
  } else if (matches(child, terms.AtCommand)) {
    return left(translate_atcommand(child));
  } else {
    unreachable();
  }
};

let translate_command_name = (node: SyntaxNode): Expression => {
  assert(matches(node, terms.CommandName));

  if (node.getChild(terms.Ident)) {
    let name_str = text(node.getChild(terms.Ident)!);
    return t.identifier(name_str);
  } else if (node.getChild(terms.Number)) {
    let n = parseInt(text(node.getChild(terms.Number)!));
    return t.memberExpression(arguments_id, t.numericLiteral(n));
  } else if (node.getChild(js_terms.Script)) {
    return translate_js(node.getChild(js_terms.Script)!);
  } else {
    unreachable();
  }
};

let translate_arg_text = (node: SyntaxNode): Expression => {
  assert(matches(node, terms.ArgText));
  let child = node.firstChild!;
  if (matches(child, terms.TextBody)) {
    return translate_textbody(child);
  } else if (matches(child, terms.VerbatimText)) {
    return t.arrayExpression([t.stringLiteral(text(child))]);
  } else {
    throw `Unknown ArgText ${child.name}`;
  }
};

let translate_ident = (node: SyntaxNode): Identifier => {
  assert(matches(node, terms.Ident));
  return t.identifier(text(node));
};

let translate_atcommand = (node: SyntaxNode): Expression => {
  assert(matches(node, terms.AtCommand));

  let name_expr = translate_command_name(node.getChild(terms.CommandName)!);
  if (name_expr.type == "Identifier" && INTRINSIC_ELEMENTS.has(name_expr.name)) {
    name_expr = t.stringLiteral(name_expr.name);
  }

  let code_args: [Expression, Expression][] = node.getChildren(terms.ArgCodeNamed).map(node => {
    let ident = node.getChild(terms.Ident)!;
    let js = node.getChild(js_terms.Script);
    return [translate_ident(ident), js ? translate_js(js) : t.booleanLiteral(true)];
  });

  let text_args = node
    .getChildren(terms.ArgText)
    .map(arg => t.spreadElement(translate_arg_text(arg)));

  return to_react(name_expr, code_args, text_args);
};

let collect_args = (arg: SyntaxNode | null): SyntaxNode[] => {
  let args = [];
  while (arg != null) {
    args.push(arg);
    arg = arg.nextSibling;
  }
  return args;
};

let translate_arg = (arg: SyntaxNode): Expression => {
  if (matches(arg, terms.ArgCodeAnon)) {
    return translate_js(arg.getChild(js_terms.Script)!);
  } else if (matches(arg, terms.ArgText)) {
    return translate_arg_text(arg);
  } else {
    unreachable();
  }
};

let translate_hashcommand = (node: SyntaxNode): Expression => {
  assert(matches(node, terms.HashCommand));

  let name = node.getChild(terms.CommandName)!;
  let name_expr = translate_command_name(name);
  let args = collect_args(name.nextSibling).map(translate_arg);

  return args.length == 0 ? name_expr : t.callExpression(name_expr, args);
};

let translate_pctcommand = (node: SyntaxNode): Statement | null => {
  assert(matches(node, terms.PctCommand));

  let name_node = node.getChild(terms.Ident)!;
  let name = text(name_node);
  let args = collect_args(name_node.nextSibling).map(translate_arg);

  if (name == "import" || name == "import_default") {
    let imports = args.slice(1).map(arg => {
      if (arg.type != "Identifier") {
        throw `Invalid import: ${arg}`;
      }
      return name == "import_default" ? t.importDefaultSpecifier(arg) : t.importSpecifier(arg, arg);
    });
    if (args[0].type != "StringLiteral") {
      throw `Invalid import path: ${args[0]}`;
    }
    global.imports.add(t.importDeclaration(imports, args[0]));

    return null;
  } else if (name == "let") {
    let lhs = args[0];
    if (lhs.type != "Identifier") {
      throw `Invalid let-var: ${lhs}`;
    }
    let rhs = args[1];
    return binding(lhs, rhs);
  } else if (name == "letfn") {
    let lhs = args[0];
    if (lhs.type != "Identifier") {
      throw `Invalid let-var: ${lhs}`;
    }
    let rhs = args[1];
    return binding(lhs, lambda(rhs));
  } else if (name == "debugger") {
    return t.debuggerStatement();
  } else {
    throw `Unknown %-command ${name}`;
  }
};
