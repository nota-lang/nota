import type { BabelFileResult, PluginObj } from "@babel/core";
import * as babel from "@babel/standalone";
import type {
  ExportDeclaration,
  Expression,
  ExpressionStatement,
  Identifier,
  ImportDeclaration,
  Program,
  SpreadElement,
  Statement,
  StringLiteral,
} from "@babel/types";
import type { SyntaxNode, Tree } from "@lezer/common";
import { Either, assert, is_left, left, right, unreachable } from "@nota-lang/nota-common";
import _ from "lodash";

import * as t from "./babel-polyfill";
import { INTRINSIC_ELEMENTS } from "./intrinsic-elements";
//@ts-ignore
import * as terms from "./nota.grammar";

export let matches = (node: SyntaxNode, term: number): boolean => node.type.id == term;
let matches_newline = (node: SyntaxNode): boolean =>
  matches(node, terms.NotaNewline); /*|| matches(node, terms.Multinewline)*/

export class Translator {
  input: string;
  imports: Set<ImportDeclaration> = new Set();
  exports: Set<ExportDeclaration> = new Set();

  constructor(input: string) {
    this.input = input;
  }

  text(cursor: SyntaxNode): string {
    return this.input.slice(cursor.from, cursor.to);
  }

  translate_textbody(node: SyntaxNode): Expression {
    assert(matches(node, terms.TextBody));

    let tokens = node.getChildren(terms.TextToken);

    // Remove whitespace on the last line
    let last = _.last(tokens);
    if (last && matches(last.firstChild!, terms.Text)) {
      let s = this.text(last);
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
              let s = this.text(tokens[i]);
              return s.match(/^( )*/)![0].length;
            })
            .reduce((a, b) => Math.min(a, b))
        : 0;

    let output: Either<Expression, Array<Statement>>[] = [];
    tokens.forEach((token, i) => {
      if (line_starts.includes(i)) {
        let stripped = this.text(token).slice(min_leading_whitespace);
        if (stripped.length > 0) {
          output.push(left(process_text(stripped)));
        }
      } else if (matches_newline(token.firstChild!) && (i == 0 || i == tokens.length - 1)) {
        // pass
      } else {
        output.push(this.translate_token(token));
      }
    });

    let array: (Expression | SpreadElement)[] = [];
    let cur_array = array;
    output.forEach(result => {
      if (is_left(result)) {
        cur_array.push(result.value);
      } else {
        let new_array: (Expression | SpreadElement)[] = [];
        let body = t.blockStatement([
          ...result.value,
          t.returnStatement(t.arrayExpression(new_array)),
        ]);
        let fn = t.spreadElement(t.callExpression(t.arrowFunctionExpression([], body), []));
        cur_array.push(fn);
        cur_array = new_array;
      }
    });

    return t.arrayExpression(array);
  }

  translate_token(node: SyntaxNode): TranslatedToken {
    assert(matches(node, terms.TextToken));

    let child = node.firstChild!;
    if (matches(child, terms.Command)) {
      return this.translate_command(child);
    } else if (matches(child, terms.Text)) {
      return left(process_text(this.text(child)));
    } else if (matches(child, terms.NotaNewline)) {
      return left(t.stringLiteral("\n"));
    } /*else if (matches(child, terms.Multinewline)) {
    return left(t.stringLiteral("\n\n"));
  }*/ else {
      throw `Unhandled child type ${child.name}`;
    }
  }

  translate_command(node: SyntaxNode): TranslatedToken {
    assert(matches(node, terms.Command));

    let child = node.firstChild!;
    if (matches(child, terms.PctCommand)) {
      return right(this.translate_pctcommand(child));
    } else if (matches(child, terms.HashCommand)) {
      return left(this.translate_hashcommand(child));
    } else if (matches(child, terms.AtCommand)) {
      return left(this.translate_atcommand(child));
    } else {
      unreachable();
    }
  }

  translate_command_name(node: SyntaxNode): Expression {
    assert(matches(node, terms.CommandName));

    if (node.getChild(terms.VariableName)) {
      let name_str = this.text(node.getChild(terms.VariableName)!);
      return t.identifier(name_str);
    } else if (node.getChild(terms.Number)) {
      let n = parseInt(this.text(node.getChild(terms.Number)!));
      return t.memberExpression(arguments_id, t.numericLiteral(n));
    } else if (node.getChild(terms.NotaExpression)) {
      return this.translate_js(node.getChild(terms.NotaExpression)!);
    } else {
      unreachable();
    }
  }

  translate_arg_text(node: SyntaxNode): Expression {
    assert(matches(node, terms.ArgText));
    let child = node.firstChild!;
    if (matches(child, terms.TextBody)) {
      return this.translate_textbody(child);
    } else if (matches(child, terms.VerbatimText)) {
      return t.arrayExpression([t.stringLiteral(this.text(child))]);
    } else {
      throw `Unknown ArgText ${child.name}`;
    }
  }

  translate_ident(node: SyntaxNode): Identifier {
    assert(matches(node, terms.VariableName));
    return t.identifier(this.text(node));
  }

  translate_atcommand(node: SyntaxNode): Expression {
    assert(matches(node, terms.AtCommand));

    let name_node, name_expr;
    if ((name_node = node.getChild(terms.CommandName))) {
      name_expr = this.translate_command_name(name_node);
      if (name_expr.type == "Identifier" && INTRINSIC_ELEMENTS.has(name_expr.name)) {
        name_expr = t.stringLiteral(name_expr.name);
      }
    } else {
      return t.arrayExpression(
        node.getChildren(terms.ArgText).map(arg => this.translate_arg_text(arg))
      );
    }

    let code_args: [Expression, Expression][] = node.getChildren(terms.ArgCodeNamed).map(node => {
      let ident = node.getChild(terms.VariableName)!;
      let js = node.getChild(terms.NotaExpression);
      return [this.translate_ident(ident), js ? this.translate_js(js) : t.booleanLiteral(true)];
    });

    let text_args = node
      .getChildren(terms.ArgText)
      .map(arg => t.spreadElement(this.translate_arg_text(arg)));

    return to_react(name_expr, code_args, text_args);
  }

  translate_arg(arg: SyntaxNode): Expression {
    if (matches(arg, terms.ArgCodeAnon)) {
      return this.translate_js(arg.getChild(terms.NotaExpression)!);
    } else if (matches(arg, terms.ArgText)) {
      return this.translate_arg_text(arg);
    } else {
      unreachable();
    }
  }

  translate_hashcommand(node: SyntaxNode): Expression {
    assert(matches(node, terms.HashCommand));

    let name = node.getChild(terms.CommandName)!;
    let name_expr = this.translate_command_name(name);
    let args = collect_args(name.nextSibling).map(arg => this.translate_arg(arg));

    return args.length == 0 ? name_expr : t.callExpression(name_expr, args);
  }

  translate_pctcommand(node: SyntaxNode): Array<Statement> {
    assert(matches(node, terms.PctCommand));

    let stmts = parse(this.replace_nota_calls(node.getChild(terms.NotaStatement)!));
    return stmts.filter(stmt => {
      if (stmt.type == "ImportDeclaration") {
        this.imports.add(stmt);
        return false;
      } else if (stmt.type == "ExportNamedDeclaration") {
        this.exports.add(stmt);
        return false;
      } else {
        return true;
      }
    });
  }

  translate_js(node: SyntaxNode): Expression {
    assert(matches(node, terms.NotaExpression));
    return parse_expr(this.replace_nota_calls(node));
  }

  replace_nota_calls(node: SyntaxNode): string {
    let cursor = node.cursor;
    let replacements: [number, number, string][] = [];
    while (node.from <= cursor.from && cursor.to <= node.to) {
      if (matches(cursor.node, terms.AtCommand)) {
        let expr = this.translate_atcommand(cursor.node);
        let result = babel.transformFromAst(
          t.program([t.expressionStatement(expr)]),
          undefined,
          {}
        ) as any as BabelFileResult;
        let code = result.code!.slice(0, -1);
        replacements.push([cursor.from - node.from, cursor.to - node.from, code]);

        if (!cursor.next(false)) {
          break;
        }
      } else if (!cursor.next()) {
        break;
      }
    }

    let code = this.text(node);
    replacements = _.sortBy(replacements, [0]);
    let expanded = "";
    let i = 0;
    replacements.forEach(([from, to, expr]) => {
      expanded += code.slice(i, from);
      expanded += expr;
      i = to;
    });
    expanded += code.slice(i);

    return expanded;
  }
}

let fragment = t.identifier("Fragment");
let create_el = t.identifier("el");
let arguments_id = t.identifier("args");

let to_react = (
  name: Expression,
  props: ([Expression, Expression] | SpreadElement)[],
  children: (Expression | SpreadElement)[]
): Expression => {
  let args: (Expression | SpreadElement)[] = [
    name,
    t.objectExpression(props.map(p => (p instanceof Array ? t.objectProperty(p[0], p[1]) : p))),
  ];
  return t.callExpression(create_el, args.concat(children));
};

export type TranslatedFunction = (
  _symbols: { [key: string]: any },
  _imports: { [path: string]: any }
) => JSX.Element;

export interface Translation {
  js: string;
  imports: Set<string>;
}

export let optimize_plugin = (): PluginObj => ({
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
});

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

export let translate_ast = (input: string, tree: Tree): Program => {
  let node = tree.topNode;
  assert(matches(node, terms.Document));
  let translator = new Translator(input);

  let doc_body = translator.translate_textbody(node.getChild(terms.TextBody)!);
  let doc_props = t.identifier("doc_props");
  let doc = to_react(
    t.identifier("Document"),
    [t.spreadElement(doc_props)],
    [t.spreadElement(doc_body)]
  );

  //@ts-ignore
  let prelude: string[] = COMPONENTS;

  let used_prelude: Set<string> = new Set();
  t.traverse(doc, node => {
    if (node.type == "Identifier" && prelude.includes(node.name)) {
      used_prelude.add(node.name);
    }
  });

  let create_el_long = t.identifier("createElement");
  let observer = t.identifier("observer");

  let program = [
    t.importDeclaration(
      [t.importSpecifier(create_el, create_el_long), t.importSpecifier(fragment, fragment)],
      t.stringLiteral("react")
    ),
    t.importDeclaration([t.importSpecifier(observer, observer)], t.stringLiteral("mobx-react")),
    t.importDeclaration(
      Array.from(used_prelude).map(k => t.importSpecifier(t.identifier(k), t.identifier(k))),
      t.stringLiteral("@nota-lang/nota-components")
    ),
    ...Array.from(translator.imports),
    ...Array.from(translator.exports),
    t.exportDefaultDeclaration(
      t.callExpression(observer, [t.arrowFunctionExpression([doc_props], doc)])
    ),
  ];

  return t.program(program);
};

export let translate = (input: string, tree: Tree): string => {
  let program = translate_ast(input, tree);
  let result = babel.transformFromAst(program, undefined, {
    plugins: [optimize_plugin],
  }) as any as BabelFileResult;
  let js = result.code!;

  return js;
};

type TranslatedToken = Either<Expression, Array<Statement>>;

let process_text = (text: string): StringLiteral => {
  return t.stringLiteral(
    text
      .replace(/\\%/g, "%")
      .replace(/\\\[/g, "[")
      .replace(/\\\]/g, "]")
      .replace(/\\@/g, "@")
      .replace(/\\#/g, "#")
      .replace(/---/g, "—")
  );
};

let collect_args = (arg: SyntaxNode | null): SyntaxNode[] => {
  let args = [];
  while (arg != null) {
    args.push(arg);
    arg = arg.nextSibling;
  }
  return args;
};
