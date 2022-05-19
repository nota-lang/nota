import type { BabelFileResult, PluginObj } from "@babel/core";
import * as babel from "@babel/standalone";
import type {
  ExportDeclaration,
  Expression,
  ExpressionStatement,
  ImportDeclaration,
  ObjectProperty,
  Program,
  SpreadElement,
  Statement,
  StringLiteral,
} from "@babel/types";
import type { SyntaxNode, Tree } from "@lezer/common";
import { assert } from "@nota-lang/nota-common";
import { Either, isLeft, isRight, left, right } from "@nota-lang/nota-common/dist/either.js";
import indentString from "indent-string";
import _ from "lodash";
import type React from "react";

import { jsTerms, mdTerms } from "../parse/mod.js";
import * as t from "./babel-polyfill.js";
//@ts-ignore
import COMPONENTS from "./components.js";
import { INTRINSIC_ELEMENTS } from "./intrinsic-elements.js";

export let babelPolyfill = t;

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

  translateMdBlockSequence(node: SyntaxNode, ignore: number[] = []): Expression {
    let child = node.firstChild;
    let array: (Expression | SpreadElement)[] = [];
    let curArray = array;
    while (child) {
      if (ignore.includes(child.type.id)) {
        child = child.nextSibling;
        continue;
      }

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
  translateMdDocument(node: SyntaxNode): Expression {
    assert(matches(node, mdTerms.Document));
    return this.translateMdBlockSequence(node, []);
  }

  translateMdInline(node: SyntaxNode): Expression {
    let type = node.type.id;
    let mdChildren = this.markdownChildren(node);
    let delimitedTypes: { [ty: number]: string } = {
      [mdTerms.StrongEmphasis]: "strong",
      [mdTerms.Emphasis]: "em",
      [mdTerms.InlineCode]: "code",
      [mdTerms.Strikethrough]: "s",
    };
    if (type in delimitedTypes) {
      let children = this.translateMdInlineSequence(mdChildren.slice(1, -1));
      return toReact(strLit(delimitedTypes[type]), [], children);
    } else {
      switch (type) {
        case mdTerms.Link: {
          let linkMarkIndexes = mdChildren
            .map<[Either<SyntaxNode, string>, number]>((node, i) => [node, i])
            .filter(([node]) => isLeft(node) && node.value.type.id == mdTerms.LinkMark)
            .map(([_, i]) => i);
          let display = mdChildren.slice(linkMarkIndexes[0] + 1, linkMarkIndexes[1]);
          let url = node.getChild(mdTerms.URL)!;
          let children = this.translateMdInlineSequence(display);
          return toReact(strLit("a"), [[strLit("href"), strLit(this.text(url))]], children);
        }

        case mdTerms.QuoteMark: {
          return t.nullLiteral();
        }

        case mdTerms.Escape: {
          return strLit(this.text(node).slice(1));
        }

        case mdTerms.NotaInlineComponent: {
          return this.translateNotaComponent(node);
        }

        case mdTerms.NotaInterpolation: {
          return this.translateNotaInterpolation(node);
        }

        default: {
          throw `Inline element not yet implemented: ${node.name} (${this.text(node)})`;
        }
      }
    }
  }

  translateMdInlineSequence(sequence: MarkdownChildren): Expression[] {
    return sequence.map(child =>
      isLeft(child) ? this.translateMdInline(child.value) : strLit(child.value)
    );
  }

  translateMdBlock(node: SyntaxNode): [Expression, Statement[]] {
    let type = node.type.id;

    let mdChildren = this.markdownChildren(node);
    switch (type) {
      case mdTerms.Paragraph: {
        let children = this.translateMdInlineSequence(mdChildren);
        return [toReact(strLit("p"), [], children), []];
      }

      case mdTerms.ATXHeading1:
      case mdTerms.ATXHeading2:
      case mdTerms.ATXHeading3:
      case mdTerms.ATXHeading4:
      case mdTerms.ATXHeading5:
      case mdTerms.ATXHeading6: {
        let depth = type - mdTerms.ATXHeading1 + 1;
        // slice(1) for HeaderMark
        let children = this.translateMdInlineSequence(mdChildren.slice(1));
        return [toReact(strLit(`h${depth}`), [], children), []];
      }

      case mdTerms.FencedCode: {
        let _codeInfo = node.getChild(mdTerms.CodeInfo); // TODO
        let codeText = node.getChild(mdTerms.CodeText)!;
        return [toReact(strLit("pre"), [], [strLit(this.text(codeText))]), []];
      }

      case mdTerms.Blockquote: {
        let [expr, stmts] = this.translateMdBlock(node.lastChild!);
        return [toReact(strLit("blockquote"), [], [expr]), stmts];
      }

      case mdTerms.OrderedList:
      case mdTerms.BulletList: {
        let stmts: Statement[] = [];
        let items = node.getChildren(mdTerms.ListItem).map(item => {
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
        let tag = type == mdTerms.OrderedList ? "ol" : "ul";
        return [toReact(strLit(tag), [], items), stmts];
      }

      case jsTerms.NotaStmts: {
        let stmts = parse(this.replaceNotaCalls(node));
        let inlineStmts = stmts.filter(stmt => {
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
        return [t.nullLiteral(), inlineStmts];
      }

      case mdTerms.NotaBlockComponent: {
        return [this.translateNotaComponent(node), []];
      }

      default: {
        console.trace();
        throw `Block element not yet implemented: ${node.name} (${this.text(node)})`;
      }
    }
  }

  translateNotaCommandName(node: SyntaxNode): Expression {
    assert(matches(node, mdTerms.NotaCommandName));

    let jsNode = node.getChild(mdTerms.NotaJs);
    if (jsNode) {
      return parseExpr(this.replaceNotaCalls(jsNode));
    } else {
      return t.identifier(this.text(node));
    }
  }

  translateNotaInterpolation(node: SyntaxNode): Expression {
    assert(matches(node, mdTerms.NotaInterpolation));

    let nameNode = node.getChild(mdTerms.NotaCommandName)!;
    let nameExpr = this.translateNotaCommandName(nameNode);

    let args = node.getChildren(mdTerms.NotaInlineContent).map(child => {
      let subchildren = this.markdownChildren(child).slice(1, -1);
      let exprs = this.translateMdInlineSequence(subchildren);
      return t.arrayExpression(exprs);
    });

    if (args.length > 0) {
      return t.callExpression(nameExpr, args);
    } else {
      return nameExpr;
    }
  }

  translateNotaComponent(node: SyntaxNode): Expression {
    assert(matches(node, mdTerms.NotaBlockComponent) || matches(node, mdTerms.NotaInlineComponent));

    let nameNode = node.getChild(mdTerms.NotaCommandName)!;
    let nameExpr = this.translateNotaCommandName(nameNode);
    if (nameExpr.type == "Identifier" && INTRINSIC_ELEMENTS.has(nameExpr.name)) {
      nameExpr = strLit(nameExpr.name);
    }

    let attrExprs = [];
    let inlineAttrs = node.getChild(jsTerms.NotaInlineAttrs);
    if (inlineAttrs) {
      let properties = inlineAttrs
        .getChildren(jsTerms.Property)
        .map(child => this.replaceNotaCalls(child))
        .join(", ");
      attrExprs.push(parseExpr(`{${properties}}`));
    }

    let blockAttrs = node.getChildren(mdTerms.NotaBlockAttribute);
    let blockAttrKvs: ObjectProperty[] = [];
    blockAttrs.forEach(child => {
      let key = strLit(this.text(child.getChild(mdTerms.NotaAttributeKey)!));
      let value = parseExpr(this.replaceNotaCalls(child.getChild(jsTerms.NotaExpr)!));
      blockAttrKvs.push(t.objectProperty(key, value));
    });
    if (blockAttrKvs.length > 0) {
      attrExprs.push(t.objectExpression(blockAttrKvs));
    }

    let attrExpr =
      attrExprs.length > 1
        ? t.objectExpression(attrExprs.map(expr => t.spreadElement(expr)))
        : attrExprs.length == 1
        ? attrExprs[0]
        : t.objectExpression([]);

    let args: (Expression | SpreadElement)[] = [nameExpr, attrExpr];

    let childrenNode = node.getChild(mdTerms.NotaInlineContent);
    if (childrenNode) {
      let subchildren = this.markdownChildren(childrenNode).filter(
        node => isRight(node) || node.value.type.id != mdTerms.NotaInlineContentMark
      );
      args = args.concat(this.translateMdInlineSequence(subchildren));
    } else {
      let subDoc = this.translateMdBlockSequence(node, [
        mdTerms.NotaCommandName,
        mdTerms.NotaBlockAttribute,
        jsTerms.NotaInlineAttrs,
      ]);
      args.push(t.spreadElement(subDoc));
    }

    return t.callExpression(createEl, args);
  }

  replaceNotaCalls(node: SyntaxNode): string {
    let cursor = node.cursor();
    let replacements: [number, number, string][] = [];
    while (node.from <= cursor.from && cursor.to <= node.to) {
      if (matches(cursor.node, mdTerms.Document)) {
        let component = cursor.node.firstChild!.firstChild!;
        let expr = this.translateNotaComponent(component);
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
