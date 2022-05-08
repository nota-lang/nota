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
import { Either, isLeft, left, right } from "@nota-lang/nota-common/dist/either";
import { assert, unreachable } from "@nota-lang/nota-common";
import _ from "lodash";

import * as t from "./babel-polyfill.js";
import { INTRINSIC_ELEMENTS } from "./intrinsic-elements.js";
//@ts-ignore
import * as terms from "./nota.grammar.terms.js";
//@ts-ignore
import COMPONENTS from "./components.js";

export let matches = (node: SyntaxNode, term: number): boolean => node.type.id == term;
let matchesNewline = (node: SyntaxNode): boolean =>
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

  translateTextbody(node: SyntaxNode): Expression {
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
    let lineStarts = tokens
      .map((_t, i) => i)
      .filter(i => {
        let lineStart = i > 0 && matchesNewline(tokens[i - 1].firstChild!);
        return lineStart && matches(tokens[i].firstChild!, terms.Text);
      });

    let minLeadingWhitespace =
      lineStarts.length > 0
        ? lineStarts
            .map(i => {
              let s = this.text(tokens[i]);
              return s.match(/^( )*/)![0].length;
            })
            .reduce((a, b) => Math.min(a, b))
        : 0;

    let output: Either<Expression, Array<Statement>>[] = [];
    tokens.forEach((token, i) => {
      if (lineStarts.includes(i)) {
        let stripped = this.text(token).slice(minLeadingWhitespace);
        if (stripped.length > 0) {
          output.push(left(processText(stripped)));
        }
      } else if (matchesNewline(token.firstChild!) && (i == 0 || i == tokens.length - 1)) {
        // pass
      } else {
        output.push(this.translateToken(token));
      }
    });

    let array: (Expression | SpreadElement)[] = [];
    let curArray = array;
    output.forEach(result => {
      if (isLeft(result)) {
        curArray.push(result.value);
      } else {
        let newArray: (Expression | SpreadElement)[] = [];
        let body = t.blockStatement([
          ...result.value,
          t.returnStatement(t.arrayExpression(newArray)),
        ]);
        let fn = t.spreadElement(t.callExpression(t.arrowFunctionExpression([], body), []));
        curArray.push(fn);
        curArray = newArray;
      }
    });

    return t.arrayExpression(array);
  }

  translateToken(node: SyntaxNode): TranslatedToken {
    assert(matches(node, terms.TextToken));

    let child = node.firstChild!;
    if (matches(child, terms.Command)) {
      return this.translateCommand(child);
    } else if (matches(child, terms.Text)) {
      return left(processText(this.text(child)));
    } else if (matches(child, terms.NotaNewline)) {
      return left(t.stringLiteral("\n"));
    } /*else if (matches(child, terms.Multinewline)) {
    return left(t.stringLiteral("\n\n"));
  }*/ else {
      throw `Unhandled child type ${child.name}`;
    }
  }

  translateCommand(node: SyntaxNode): TranslatedToken {
    assert(matches(node, terms.Command));

    let child = node.firstChild!;
    if (matches(child, terms.PctCommand)) {
      return right(this.translatePctcommand(child));
    } else if (matches(child, terms.HashCommand)) {
      return left(this.translateHashcommand(child));
    } else if (matches(child, terms.AtCommand)) {
      return left(this.translateAtcommand(child));
    } else {
      unreachable();
    }
  }

  translateCommandName(node: SyntaxNode): Expression {
    assert(matches(node, terms.CommandName));

    if (node.getChild(terms.VariableName)) {
      let nameStr = this.text(node.getChild(terms.VariableName)!);
      return t.identifier(nameStr);
    } else if (node.getChild(terms.Number)) {
      let n = parseInt(this.text(node.getChild(terms.Number)!));
      return t.memberExpression(argumentsId, t.numericLiteral(n));
    } else if (node.getChild(terms.NotaExpression)) {
      return this.translateJs(node.getChild(terms.NotaExpression)!);
    } else {
      unreachable();
    }
  }

  translateArgText(node: SyntaxNode): Expression {
    assert(matches(node, terms.ArgText));
    let child = node.firstChild!;
    if (matches(child, terms.TextBody)) {
      return this.translateTextbody(child);
    } else if (matches(child, terms.VerbatimText)) {
      return t.arrayExpression([t.stringLiteral(this.text(child))]);
    } else {
      throw `Unknown ArgText ${child.name}`;
    }
  }

  translateIdent(node: SyntaxNode): Identifier {
    assert(matches(node, terms.VariableName));
    return t.identifier(this.text(node));
  }

  translateAtcommand(node: SyntaxNode): Expression {
    assert(matches(node, terms.AtCommand));

    let nameNode, nameExpr;
    if ((nameNode = node.getChild(terms.CommandName))) {
      nameExpr = this.translateCommandName(nameNode);
      if (nameExpr.type == "Identifier" && INTRINSIC_ELEMENTS.has(nameExpr.name)) {
        nameExpr = t.stringLiteral(nameExpr.name);
      }
    } else {
      return t.arrayExpression(
        node.getChildren(terms.ArgText).map(arg => this.translateArgText(arg))
      );
    }

    let codeArgs: [Expression, Expression][] = node.getChildren(terms.ArgCodeNamed).map(node => {
      let ident = node.getChild(terms.VariableName)!;
      let js = node.getChild(terms.NotaExpression);
      return [this.translateIdent(ident), js ? this.translateJs(js) : t.booleanLiteral(true)];
    });

    let textArgs = node
      .getChildren(terms.ArgText)
      .map(arg => t.spreadElement(this.translateArgText(arg)));

    return toReact(nameExpr, codeArgs, textArgs);
  }

  translateArg(arg: SyntaxNode): Expression {
    if (matches(arg, terms.ArgCodeAnon)) {
      return this.translateJs(arg.getChild(terms.NotaExpression)!);
    } else if (matches(arg, terms.ArgText)) {
      return this.translateArgText(arg);
    } else {
      unreachable();
    }
  }

  translateHashcommand(node: SyntaxNode): Expression {
    assert(matches(node, terms.HashCommand));

    let name = node.getChild(terms.CommandName)!;
    let nameExpr = this.translateCommandName(name);
    let args = collectArgs(name.nextSibling).map(arg => this.translateArg(arg));

    return args.length == 0 ? nameExpr : t.callExpression(nameExpr, args);
  }

  translatePctcommand(node: SyntaxNode): Array<Statement> {
    assert(matches(node, terms.PctCommand));

    let stmts = parse(this.replaceNotaCalls(node.getChild(terms.NotaStatement)!));
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

  translateJs(node: SyntaxNode): Expression {
    assert(matches(node, terms.NotaExpression));
    return parseExpr(this.replaceNotaCalls(node));
  }

  replaceNotaCalls(node: SyntaxNode): string {
    let cursor = node.cursor;
    let replacements: [number, number, string][] = [];
    while (node.from <= cursor.from && cursor.to <= node.to) {
      if (matches(cursor.node, terms.AtCommand)) {
        let expr = this.translateAtcommand(cursor.node);
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
let createEl = t.identifier("el");
let argumentsId = t.identifier("args");

let toReact = (
  name: Expression,
  props: ([Expression, Expression] | SpreadElement)[],
  children: (Expression | SpreadElement)[]
): Expression => {
  let args: (Expression | SpreadElement)[] = [
    name,
    t.objectExpression(props.map(p => (p instanceof Array ? t.objectProperty(p[0], p[1]) : p))),
  ];
  return t.callExpression(createEl, args.concat(children));
};

export type TranslatedFunction = (
  _symbols: { [key: string]: any },
  _imports: { [path: string]: any }
) => JSX.Element;

export interface Translation {
  js: string;
  imports: Set<string>;
}

export let optimizePlugin = (): PluginObj => ({
  visitor: {
    ArrayExpression(path) {
      // [...[e1, e2]] => [e1, e2]
      path.node.elements = path.node.elements
        .map(el => {
          if (el && el.type == "SpreadElement" && el.argument.type == "ArrayExpression") {
            return el.argument.elements;
          } else {
            return [el];
          }
        })
        .flat();
    },

    ObjectExpression(path) {
      let props = path.node.properties;
      /// {...e} => e
      if (props.length == 1 && props[0].type == "SpreadElement") {
        path.replaceWith(props[0].argument);
      }
    },

    CallExpression(path) {
      let expr = path.node;
      if (
        expr.arguments.length == 0 &&
        expr.arguments.length == 0 &&
        expr.callee.type == "ArrowFunctionExpression" &&
        expr.callee.body.type == "BlockStatement" &&
        expr.callee.body.body.length == 1 &&
        expr.callee.body.body[0].type == "ReturnStatement" &&
        expr.callee.body.body[0].argument
      ) {
        // `(() => { return e; })()` => `e`
        path.replaceWith(expr.callee.body.body[0].argument);
        path.visit();
      } else {
        path.node.arguments = path.node.arguments
          .map(arg => {
            // f(...[x, y]) => f(x, y)
            if (arg.type == "SpreadElement" && arg.argument.type == "ArrayExpression") {
              return arg.argument.elements.map(el => el!);
            } else {
              return [arg];
            }
          })
          .flat();
      }
    },
  },
});

let parse = (code: string): Statement[] => {
  let result = babel.transform(code, {
    ast: true,
  }) as any as BabelFileResult;
  return result.ast!.program.body;
};

export let parseExpr = (code: string): Expression => {
  let s = parse(`(${code});`)[0] as ExpressionStatement;
  return s.expression;
};

export let lambda = (body: Expression) =>
  t.arrowFunctionExpression([t.restElement(argumentsId)], body);

export let translateAst = (input: string, tree: Tree): Program => {
  let node = tree.topNode;
  assert(matches(node, terms.Document));
  let translator = new Translator(input);

  let docBody = translator.translateTextbody(node.getChild(terms.TextBody)!);
  let docProps = t.identifier("docProps");
  let doc = toReact(
    t.identifier("Document"),
    [t.spreadElement(docProps)],
    [t.spreadElement(docBody)]
  );

  let prelude: { [k: string]: string } = COMPONENTS;

  let usedPrelude: Set<string> = new Set();
  t.traverse(doc, node => {
    if (node.type == "Identifier" && node.name in prelude) {
      usedPrelude.add(node.name);
    }
  });

  let preludeImports: { [k: string]: string[] } = {};
  for (let k of usedPrelude) {
    let path = prelude[k];
    if (!(path in preludeImports)) {
      preludeImports[path] = [];
    }
    preludeImports[path].push(k);
  }

  let createElLong = t.identifier("createElement");
  let observer = t.identifier("observer");

  let program: Statement[] = [
    t.importDeclaration(
      [t.importSpecifier(createEl, createElLong), t.importSpecifier(fragment, fragment)],
      t.stringLiteral("react")
    ),
    t.importDeclaration([t.importSpecifier(observer, observer)], t.stringLiteral("mobx-react")),
    t.importDeclaration(
      Object.keys(preludeImports).map(mod =>
        t.importSpecifier(t.identifier(mod), t.identifier(mod))
      ),
      t.stringLiteral("@nota-lang/nota-components")
    ),
    ..._.toPairs(preludeImports).map(([mod, ks]) =>
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.objectPattern(ks.map(k => t.objectProperty(t.identifier(k), t.identifier(k), true))),
          t.identifier(mod)
        ),
      ])
    ),
    // ..._.toPairs(preludeImports).map(([path, ks]) =>
    //   t.importDeclaration(
    //     ks.map(k => t.importSpecifier(t.identifier(k), t.identifier(k))),
    //     t.stringLiteral(path)
    //   ),
    // ),
    ...Array.from(translator.imports),
    ...Array.from(translator.exports),
    t.exportDefaultDeclaration(
      t.callExpression(observer, [t.arrowFunctionExpression([docProps], doc)])
    ),
  ];

  return t.program(program);
};

export let translate = (input: string, tree: Tree): string => {
  let program = translateAst(input, tree);
  let result = babel.transformFromAst(program, undefined, {
    plugins: [optimizePlugin],
  }) as any as BabelFileResult;
  let js = result.code!;

  return js;
};

type TranslatedToken = Either<Expression, Array<Statement>>;

let processText = (text: string): StringLiteral => {
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

let collectArgs = (arg: SyntaxNode | null): SyntaxNode[] => {
  let args = [];
  while (arg != null) {
    args.push(arg);
    arg = arg.nextSibling;
  }
  return args;
};
