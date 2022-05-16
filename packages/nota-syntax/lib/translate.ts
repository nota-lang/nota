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
import { Either, isLeft, left, right } from "@nota-lang/nota-common/dist/either.js";
import { assert, unreachable } from "@nota-lang/nota-common";
import _ from "lodash";
import type React from "react";
import indentString from "indent-string";
import { isSome, none, Option, some } from "@nota-lang/nota-common/dist/option.js";

import * as t from "./babel-polyfill.js";
import { INTRINSIC_ELEMENTS } from "./intrinsic-elements.js";
// import { Type as MdTerms } from "./parse.js";
import { Type as MdTerms } from "./markdown.js";
//@ts-ignore
import * as terms from "./nota.grammar.terms.js";
//@ts-ignore
import COMPONENTS from "./components.js";

export let matches = (node: SyntaxNode, term: number): boolean => node.type.id == term;

let strLit = t.stringLiteral;

let scopeStatements = (stmts: Statement[], expr: Expression): Expression => {
  if (stmts.length == 0) {
    return expr;
  } else {
    let body = t.blockStatement([...stmts, t.returnStatement(expr)]);
    let fn_call = t.callExpression(t.arrowFunctionExpression([], body), []);
    return fn_call;
  }
};

type MarkdownChildren = Either<SyntaxNode, string>[];

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

  private markdownChildren(node: SyntaxNode): MarkdownChildren {
    let children: MarkdownChildren = [];
    let pos = node.from;
    let child = node.firstChild;

    let pushStr = (from: number, to: number) => {
      children.push(right(this.input.slice(from, to)));
    };

    while (child) {
      if (child.from > pos) {
        pushStr(pos, child.from);
      }

      children.push(left(child));
      pos = child.to;
      child = child.nextSibling;
    }

    if (pos < node.to) {
      pushStr(pos, node.to);
    }

    return children;
  }

  translateMdDocument(node: SyntaxNode): Expression {
    assert(matches(node, MdTerms.Document));

    let child = node.firstChild;
    let array: (Expression | SpreadElement)[] = [];
    let curArray = array;
    while (child) {
      let [expr, stmts] = this.translateMdBlock(child);
      if (stmts.length > 0) {
        let newArray: (Expression | SpreadElement)[] = [expr];
        let scopedExpr = scopeStatements(stmts, t.arrayExpression(newArray));
        curArray.push(t.spreadElement(scopedExpr));
        curArray = newArray;
      } else {
        curArray.push(expr);
      }
      child = child.nextSibling;
    }

    return t.arrayExpression(array);
  }

  translateMdInline(node: SyntaxNode): [Option<Expression>, Statement[]] {
    let type = node.type.id;
    if (type == terms.Command) {
      let trans = this.translateCommand(node);
      if (isLeft(trans)) {
        return [some(trans.value), []];
      } else {
        return [none(), trans.value];
      }
    } else {
      let mdChildren = this.markdownChildren(node);
      let delimitedTypes: { [ty: number]: string } = {
        [MdTerms.StrongEmphasis]: "strong",
        [MdTerms.Emphasis]: "em",
        [MdTerms.InlineCode]: "code",
      };
      if (type in delimitedTypes) {
        let [children, stmts] = this.translateMdInlineSequence(mdChildren.slice(1, -1));
        return [some(toReact(strLit(delimitedTypes[type]), [], children)), stmts];
      } else if (type == MdTerms.Link) {
        let linkMarkIndexes = mdChildren
          .map<[Either<SyntaxNode, string>, number]>((node, i) => [node, i])
          .filter(([node]) => isLeft(node) && node.value.type.id == MdTerms.LinkMark)
          .map(([_, i]) => i);
        let display = mdChildren.slice(linkMarkIndexes[0] + 1, linkMarkIndexes[1]);
        let url = node.getChild(MdTerms.URL)!;
        let [children, stmts] = this.translateMdInlineSequence(display);
        return [
          some(toReact(strLit("a"), [[strLit("href"), strLit(this.text(url))]], children)),
          stmts,
        ];
      } else if (type == MdTerms.QuoteMark) {
        return [none(), []];
      } else {
        throw `Not yet implemented: ${node.name}`;
      }
    }
  }

  translateMdInlineSequence(sequence: MarkdownChildren): [Expression[], Statement[]] {
    let stmts: Statement[] = [];
    let children: Expression[] = [];
    sequence.forEach(child => {
      if (isLeft(child)) {
        let [child_expr, child_stmts] = this.translateMdInline(child.value);
        if (isSome(child_expr)) {
          children.push(child_expr.value);
        }
        stmts = stmts.concat(child_stmts);
      } else {
        children.push(strLit(child.value));
      }
    });
    return [children, stmts];
  }

  translateMdBlock(node: SyntaxNode): [Expression, Statement[]] {
    let type = node.type.id;
    if (type == terms.Command) {
      let trans = this.translateCommand(node);
      if (isLeft(trans)) {
        return [trans.value, []];
      } else {
        return [t.nullLiteral(), trans.value];
      }
    } else {
      let mdChildren = this.markdownChildren(node);
      switch (type) {
        case MdTerms.Paragraph: {
          let [children, stmts] = this.translateMdInlineSequence(mdChildren);
          return [toReact(strLit("p"), [], children), stmts];
        }

        case MdTerms.ATXHeading1:
        case MdTerms.ATXHeading2:
        case MdTerms.ATXHeading3:
        case MdTerms.ATXHeading4:
        case MdTerms.ATXHeading5:
        case MdTerms.ATXHeading6: {
          let depth = type - MdTerms.ATXHeading1 + 1;
          // slice(1) for HeaderMark
          let [children, stmts] = this.translateMdInlineSequence(mdChildren.slice(1));
          return [toReact(strLit(`h${depth}`), [], children), stmts];
        }

        case MdTerms.FencedCode: {
          let _codeInfo = node.getChild(MdTerms.CodeInfo); // TODO
          let codeText = node.getChild(MdTerms.CodeText)!;
          return [toReact(strLit("pre"), [], [strLit(this.text(codeText))]), []];
        }

        case MdTerms.Blockquote: {
          let [expr, stmts] = this.translateMdBlock(node.lastChild!);
          return [toReact(strLit("blockquote"), [], [expr]), stmts];
        }

        case MdTerms.OrderedList:
        case MdTerms.BulletList: {
          let stmts: Statement[] = [];
          let items = node.getChildren(MdTerms.ListItem).map(item => {
            let children = collectSiblings(item.firstChild);
            let exprs: Expression[] = [];
            // slice(1) for ItemMark
            children.slice(1).forEach(child => {
              let [child_expr, child_stmts] = this.translateMdBlock(child);
              exprs.push(child_expr);
              stmts = stmts.concat(child_stmts);
            });

            return toReact(strLit("li"), [], exprs);
          });
          let tag = type == MdTerms.OrderedList ? "ol" : "ul";
          return [toReact(strLit(tag), [], items), stmts];
        }

        default: {
          throw `Not yet implements: ${node.name}`;
        }
      }
    }
  }

  translateCommand(node: SyntaxNode): TranslatedToken {
    assert(matches(node, terms.Command));

    let child = node.firstChild!;
    if (matches(child, terms.PctCommand)) {
      return right(this.translatePctCommand(child));
    } else if (matches(child, terms.HashCommand)) {
      return left(this.translateHashCommand(child));
    } else if (matches(child, terms.AtCommand)) {
      return left(this.translateAtCommand(child));
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
    let mdDoc = node.getChild(MdTerms.Document)!;
    let firstBlock = mdDoc.firstChild;
    if (firstBlock && !firstBlock.nextSibling && firstBlock.type.id == MdTerms.Paragraph) {
      let [expr, stmts] = this.translateMdInlineSequence(this.markdownChildren(firstBlock));
      return scopeStatements(stmts, t.arrayExpression(expr));
    } else {
      return this.translateMdDocument(mdDoc);
    }
  }

  translateIdent(node: SyntaxNode): Identifier {
    assert(matches(node, terms.VariableName));
    return t.identifier(this.text(node));
  }

  translateAtCommand(node: SyntaxNode): Expression {
    assert(matches(node, terms.AtCommand));

    let nameNode, nameExpr;
    if ((nameNode = node.getChild(terms.CommandName))) {
      nameExpr = this.translateCommandName(nameNode);
      if (nameExpr.type == "Identifier" && INTRINSIC_ELEMENTS.has(nameExpr.name)) {
        nameExpr = strLit(nameExpr.name);
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

  translateHashCommand(node: SyntaxNode): Expression {
    assert(matches(node, terms.HashCommand));

    let name = node.getChild(terms.CommandName)!;
    let nameExpr = this.translateCommandName(name);
    let args = collectSiblings(name.nextSibling).map(arg => this.translateArg(arg));

    return args.length == 0 ? nameExpr : t.callExpression(nameExpr, args);
  }

  translatePctCommand(node: SyntaxNode): Statement[] {
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
    let cursor = node.cursor();
    let replacements: [number, number, string][] = [];
    while (node.from <= cursor.from && cursor.to <= node.to) {
      if (matches(cursor.node, terms.AtCommand)) {
        let expr = this.translateAtCommand(cursor.node);
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
) => React.ReactElement;

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
  let translator = new Translator(input);

  let docBody = translator.translateMdDocument(node);
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
      strLit("react")
    ),
    t.importDeclaration([t.importSpecifier(observer, observer)], strLit("mobx-react")),
    t.importDeclaration(
      Object.keys(preludeImports).map(mod =>
        t.importSpecifier(t.identifier(mod), t.identifier(mod))
      ),
      strLit("@nota-lang/nota-components")
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
    //     strLit(path)
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

export let printTree = (tree: Tree, contents: string) => {
  let depth = (node: any): number => (node.parent ? 1 + depth(node.parent) : 0);
  let cursor = tree.cursor();
  let output = "";
  do {
    let subInput = contents.slice(cursor.from, cursor.to);
    if (subInput.length > 30) {
      subInput = subInput.slice(0, 12) + "..." + subInput.slice(-12);
    }
    subInput = subInput.replace("\n", "\\n");
    output += indentString(`${cursor.name}: "${subInput}"`, 2 * depth(cursor.node)) + "\n";
  } while (cursor.next());

  console.log(output);
};

export let translate = (input: string, tree: Tree): string => {
  printTree(tree, input);
  let program = translateAst(input, tree);
  let result = babel.transformFromAst(program, undefined, {
    plugins: [optimizePlugin],
  }) as any as BabelFileResult;
  let js = result.code!;

  return js;
};

type TranslatedToken = Either<Expression, Statement[]>;

// TODO
let _processText = (text: string): StringLiteral => {
  return strLit(
    text
      .replace(/\\%/g, "%")
      .replace(/\\\[/g, "[")
      .replace(/\\\]/g, "]")
      .replace(/\\@/g, "@")
      .replace(/\\#/g, "#")
      .replace(/---/g, "—")
  );
};

let collectSiblings = (arg: SyntaxNode | null): SyntaxNode[] => {
  let args = [];
  while (arg != null) {
    args.push(arg);
    arg = arg.nextSibling;
  }
  return args;
};
