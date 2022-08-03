import type { BabelFileResult, PluginObj } from "@babel/core";
import * as babel from "@babel/standalone";
import type {
  BlockStatement,
  Declaration,
  ExportDeclaration,
  Expression,
  ExpressionStatement,
  Identifier,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  LVal,
  ObjectProperty,
  PatternLike,
  Program,
  SourceLocation,
  SpreadElement,
  Statement,
  StringLiteral,
  TemplateElement,
} from "@babel/types";
import type { SyntaxNode, Tree } from "@lezer/common";
import { assert, unreachable } from "@nota-lang/nota-common";
import { Either, isLeft, isRight, left, right } from "@nota-lang/nota-common/dist/either.js";
import he from "he";
import indentString from "indent-string";
import _ from "lodash";
import path from "path";

import type { Terms } from "../parse/extensions/nota.js";
import { jsTerms, mdTerms } from "../parse/mod.js";
import * as t from "./babel-polyfill.js";
//@ts-ignore
import COMPONENTS from "./components.js";
import { INTRINSIC_ELEMENTS } from "./intrinsic-elements.js";

export let babelPolyfill = t;

export let matches = (node: SyntaxNode, term: number): boolean => node.type.id == term;

// TODO: IMPORTANT:
// need to replace EVERY instance of getChild(NUMBER) with getChild(STRING) due to dumb term clones

let strLit = t.stringLiteral;

let anonArgsId = t.identifier("args");

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

export class LineMap {
  lines: { start: number; end: number }[] = [];

  constructor(input: string) {
    let lineStart = 0;
    for (let i = 0; i < input.length; ++i) {
      if (input[i] == "\n") {
        this.lines.push({ start: lineStart, end: i });
        lineStart = i + 1;
      }
    }
    this.lines.push({ start: lineStart, end: input.length });
  }

  offsetToLocation(n: number): { line: number; column: number } {
    if (n < 0 || n > this.lines[this.lines.length - 1].end) {
      throw new Error(`Invalid offset: ${n}`);
    }

    let line = this.lines.findIndex(l => l.start <= n && n <= l.end);
    let column = n - this.lines[line].start;
    line += 1;
    return { line, column };
  }
}

export class Translator {
  input: string;
  lineMap: LineMap;
  imports: Set<ImportDeclaration> = new Set();
  exports: Set<ExportDeclaration> = new Set();

  constructor(input: string) {
    this.input = input;
    this.lineMap = new LineMap(this.input);
  }

  text(cursor: SyntaxNode): string {
    return this.input.slice(cursor.from, cursor.to);
  }

  ident(cursor: SyntaxNode): Identifier {
    return t.identifier(this.text(cursor));
  }

  private spanned<T>(jsNode: T, lezerNode: SyntaxNode): T {
    let nodeAny: any = jsNode;
    let loc: SourceLocation = {
      start: this.lineMap.offsetToLocation(lezerNode.from),
      end: this.lineMap.offsetToLocation(lezerNode.to),
    };

    return { ...nodeAny, loc };
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

  translateInlineOrBlockSequence(node: SyntaxNode): Expression {
    let children = collectSiblings(node.firstChild);
    let expr;
    if (children.length == 1 && matches(children[0], mdTerms.Paragraph)) {
      expr = t.arrayExpression(this.translateMdInlineSequence(this.markdownChildren(children[0])));
    } else {
      expr = this.translateMdBlockSequence(node, [mdTerms.NotaBlockAttribute]);
    }
    return expr;
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
    let expr: Expression;
    if (type in delimitedTypes) {
      let children = this.translateMdInlineSequence(mdChildren.slice(1, -1));
      expr = toReact(strLit(delimitedTypes[type]), [], children);
    } else {
      switch (type) {
        // Markdown builtins:
        case mdTerms.Link: {
          let linkMarkIndexes = mdChildren
            .map<[Either<SyntaxNode, string>, number]>((node, i) => [node, i])
            .filter(([node]) => isLeft(node) && node.value.type.id == mdTerms.LinkMark)
            .map(([_, i]) => i);
          let display = mdChildren.slice(linkMarkIndexes[0] + 1, linkMarkIndexes[1]);
          let url = node.getChild(mdTerms.URL)!;
          let children = this.translateMdInlineSequence(display);
          expr = toReact(strLit("a"), [[strLit("href"), strLit(this.text(url))]], children);
          break;
        }

        case mdTerms.MathMark:
        case mdTerms.QuoteMark: {
          expr = t.nullLiteral();
          break;
        }

        case mdTerms.Escape: {
          expr = strLit(this.text(node).slice(1));
          break;
        }

        case mdTerms.URL: {
          // remove < and >
          let url = this.text(node).slice(1, -1);
          expr = toReact(strLit("a"), [[strLit("href"), strLit(url)]], [strLit(url)]);
          break;
        }

        case mdTerms.Entity: {
          expr = strLit(he.decode(this.text(node)));
          break;
        }

        case mdTerms.Image: {
          let altLeft = node.firstChild!;
          let altRight = altLeft.nextSibling!;
          let alt = this.input.slice(altLeft.to, altRight.from);
          let url = this.text(node.getChild("URL")!);
          expr = toReact(
            strLit("img"),
            [
              [strLit("src"), strLit(url)],
              [strLit("alt"), strLit(alt)],
            ],
            []
          );
          break;
        }

        // Nota extensions:
        case mdTerms.MathInline: {
          let children = this.translateNotaTemplateExternal(node);
          expr = toReact(t.identifier("$"), [], [t.spreadElement(children)]);
          break;
        }

        case mdTerms.NotaInlineComponent: {
          expr = this.translateNotaInlineComponent(node);
          break;
        }

        case mdTerms.NotaInterpolation: {
          expr = this.translateNotaInterpolation(node);
          break;
        }

        case mdTerms.Ref: {
          let nameNode = node.getChild(mdTerms.NotaCommandName)!;
          let nameExpr = this.translateNotaCommandName(nameNode);
          if (nameExpr.type == "Identifier") {
            nameExpr = strLit(nameExpr.name);
          }
          expr = toReact(t.identifier("Ref"), [], [nameExpr]);
          break;
        }

        case mdTerms.Comment: {
          expr = t.nullLiteral();
          break;
        }

        case mdTerms.Special: {
          let contents = this.text(node);
          switch (contents) {
            case "---": {
              expr = strLit("—");
              break;
            }
            default:
              throw new Error(`Unknown special: ${contents}`);
          }
          break;
        }

        default: {
          throw new Error(`Inline element not yet implemented: ${node.name} (${this.text(node)})`);
        }
      }
    }

    return this.spanned(expr, node);
  }

  translateMdInlineSequence(sequence: MarkdownChildren): Expression[] {
    return sequence.map(child =>
      isLeft(child) ? this.translateMdInline(child.value) : strLit(child.value)
    );
  }

  translateMdBlock(node: SyntaxNode): [Expression, Statement[]] {
    let type = node.type.id;

    let mdChildren = this.markdownChildren(node);
    let expr: Expression;
    let stmts: Statement[] = [];
    switch (type) {
      case mdTerms.Paragraph: {
        let children = this.translateMdInlineSequence(mdChildren);
        expr = toReact(strLit("p"), [], children);
        break;
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
        expr = toReact(strLit(`h${depth}`), [], children);
        break;
      }

      case mdTerms.CodeBlock:
      case mdTerms.FencedCode: {
        let attributes: [Expression, Expression][] = [];
        let codeInfo = node.getChild(mdTerms.CodeInfo);
        if (codeInfo) {
          attributes.push([strLit("language"), this.ident(codeInfo)]);
        }

        let codeTexts = node.getChildren(mdTerms.CodeText)!;
        let text = codeTexts.map(child => this.text(child)).join("");

        expr = toReact(t.identifier("Listing"), attributes, [strLit(text)]);
        break;
      }

      case mdTerms.Blockquote: {
        let [subexpr, substmts] = this.translateMdBlock(node.lastChild!);
        expr = toReact(strLit("blockquote"), [], [subexpr]);
        stmts = substmts;
        break;
      }

      case mdTerms.OrderedList:
      case mdTerms.BulletList: {
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
        expr = toReact(strLit(tag), [], items);
        break;
      }

      case mdTerms.Table: {
        let delimNode = node.getChild(mdTerms.TableDelimiter)!;
        let delims = this.text(delimNode)
          .split("|")
          .map(s => s.trim())
          .filter(s => s != "");
        let aligns: [Expression, Expression][][] = delims.map(s => {
          let hasLeft = s.startsWith(":");
          let hasRight = s.endsWith(":");
          let alignment =
            hasLeft && hasRight ? "center" : hasLeft ? "left" : hasRight ? "right" : undefined;
          if (alignment) {
            return [[strLit("align"), strLit(alignment)]];
          } else {
            return [];
          }
        });

        let parseRow = (node: SyntaxNode, cellType: string): Expression => {
          let cellNodes = node.getChildren(mdTerms.TableCell);
          let cells = cellNodes.map((child, i) => {
            let exprs = this.translateMdInlineSequence(this.markdownChildren(child));
            return toReact(strLit(cellType), aligns[i], exprs);
          });
          return toReact(strLit("tr"), [], cells);
        };

        let headerNode = node.getChild(mdTerms.TableHeader)!;
        let header = parseRow(headerNode, "th");
        let thead = toReact(strLit("thead"), [], [header]);

        let bodyNodes = node.getChildren(mdTerms.TableRow)!;
        let rows = bodyNodes.map(child => parseRow(child, "td"));
        let tbody = toReact(strLit("tbody"), [], rows);

        expr = toReact(strLit("table"), [], [thead, tbody]);

        break;
      }

      case mdTerms.NotaScript: {
        let child = node.getChild(jsTerms.NotaStmts);
        stmts = child ? this.extractDelimited(child).map(node => this.translateJsStmt(node)) : [];
        stmts = stmts.filter(stmt => {
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
        expr = t.nullLiteral();
        break;
      }

      case mdTerms.NotaBlockComponent: {
        expr = this.translateNotaBlockComponent(node);
        break;
      }

      case mdTerms.MathBlock: {
        let children = this.translateNotaTemplateExternal(node);
        expr = toReact(t.identifier("$$"), [], [t.spreadElement(children)]);
        break;
      }

      case mdTerms.Comment: {
        expr = t.nullLiteral();
        break;
      }

      default: {
        console.trace();
        throw new Error(`Block element not yet implemented: ${node.name} (${this.text(node)})`);
      }
    }

    return [this.spanned(expr, node), stmts];
  }

  translateNotaTemplateExternal(parent: SyntaxNode): Expression {
    let child;
    if ((child = parent.getChild(jsTerms.NotaTemplateExternal))) {
      return this.translateNotaTemplate(child.getChild(jsTerms.NotaTemplate)!);
    } else {
      return t.arrayExpression([]);
    }
  }

  translateNotaExpr(node: SyntaxNode): Expression {
    assert(matches(node, jsTerms.NotaExpr));
    return this.translateJsExpr(node.firstChild!);
  }

  translateNotaCommandName(node: SyntaxNode, terms: Terms = mdTerms): Expression {
    assert(matches(node, terms.NotaCommandName));

    let child;
    let expr;
    if ((child = node.getChild(terms.NotaCommandNameExpression))) {
      let grandchild;
      if ((grandchild = child.getChild(jsTerms.NotaExpr))) {
        expr = this.translateNotaExpr(grandchild);
      } else {
        expr = this.translateJsExpr(child.firstChild!.nextSibling!);
      }
    } else if ((child = node.getChild(terms.NotaCommandNameInteger))) {
      expr = t.memberExpression(anonArgsId, t.numericLiteral(parseInt(this.text(child)) - 1));
    } else if ((child = node.getChild(terms.NotaCommandNameIdentifier))) {
      expr = this.ident(node);
    } else {
      unreachable();
    }

    return expr;
  }

  translateNotaInterpolation(node: SyntaxNode): Expression {
    assert(matches(node, mdTerms.NotaInterpolation));

    let nameNode = node.getChild(mdTerms.NotaCommandName);
    let nameExpr = nameNode ? this.translateNotaCommandName(nameNode) : null;

    let args = node
      .getChildren(mdTerms.NotaInlineContent)
      .map(child => t.arrayExpression(this.translateNotaInlineContent(child)));

    let expr;
    if (nameExpr) {
      if (args.length > 0) {
        expr = t.callExpression(nameExpr, args);
      } else {
        expr = nameExpr;
      }
    } else {
      expr = t.arrayExpression(args);
    }

    return this.spanned(expr, node);
  }

  translateNotaInlineAttrs(node: SyntaxNode): Expression {
    assert(matches(node, jsTerms.NotaInlineAttrs));
    let properties = node
      .getChildren(jsTerms.Property)
      .map(child => this.translateJsProperty(child));
    return t.objectExpression(properties);
  }

  translateNotaInlineContent(node: SyntaxNode): Expression[] {
    assert(matches(node, mdTerms.NotaInlineContent));
    let subchildren = this.markdownChildren(node).filter(
      node => isRight(node) || node.value.type.id != mdTerms.NotaInlineContentMark
    );
    return this.translateMdInlineSequence(subchildren);
  }

  translateNotaInlineComponent(node: SyntaxNode): Expression {
    assert(matches(node, mdTerms.NotaInlineComponent));

    let nameNode = node.getChild(mdTerms.NotaCommandName);
    let name = nameNode ? this.translateNotaCommandName(nameNode) : t.identifier("Fragment");
    if (name.type == "Identifier" && INTRINSIC_ELEMENTS.has(name.name)) {
      name = strLit(name.name);
    }

    let inlineAttrsNode = node.getChild(jsTerms.NotaInlineAttrs);
    let attrs = inlineAttrsNode
      ? this.translateNotaInlineAttrs(inlineAttrsNode)
      : t.objectExpression([]);
    if (name.type != "StringLiteral") {
      attrs = t.objectExpression([
        t.spreadElement(attrs),
        t.objectProperty({ key: strLit("block"), value: t.booleanLiteral(false) }),
      ]);
    }

    let childrenNode;
    let args: (Expression | SpreadElement)[];
    if ((childrenNode = node.getChild(mdTerms.NotaInlineContent))) {
      args = this.translateNotaInlineContent(childrenNode);
    } else if ((childrenNode = node.getChild(mdTerms.Document))) {
      let block = childrenNode.firstChild!;
      args = this.translateMdInlineSequence(this.markdownChildren(block));
    } else {
      args = [];
    }

    let expr = t.callExpression(createEl, [name, attrs, ...args]);
    return this.spanned(expr, node);
  }

  translateNotaBlockAttribute(node: SyntaxNode): ObjectProperty {
    assert(matches(node, mdTerms.NotaBlockAttribute));
    let key = strLit(this.text(node.getChild(mdTerms.NotaAttributeKey)!));
    let child;
    let children: (Expression | SpreadElement)[] = [];
    if ((child = node.getChild(mdTerms.NotaInlineContent))) {
      children = children.concat(this.translateNotaInlineContent(child));
    }
    if ((child = node.getChild(mdTerms.NotaBlockContent))) {
      children.push(t.spreadElement(this.translateInlineOrBlockSequence(child)));
    }

    let value = toReact(t.identifier("Fragment"), [], children);

    return t.objectProperty({ key, value });
  }

  translateNotaBlockComponent(node: SyntaxNode): Expression {
    assert(matches(node, mdTerms.NotaBlockComponent));

    let nameNode = node.getChild(mdTerms.NotaCommandName);
    let name = nameNode ? this.translateNotaCommandName(nameNode) : t.identifier("Fragment");
    if (name.type == "Identifier" && INTRINSIC_ELEMENTS.has(name.name)) {
      name = strLit(name.name);
    }

    let attrExprs: Expression[] = [];
    if (name.type != "StringLiteral") {
      attrExprs.push(
        t.objectExpression([
          t.objectProperty({ key: strLit("block"), value: t.booleanLiteral(true) }),
        ])
      );
    }
    let inlineAttrsNode = node.getChild(jsTerms.NotaInlineAttrs);
    if (inlineAttrsNode) attrExprs.push(this.translateNotaInlineAttrs(inlineAttrsNode));

    let blockAttrs =
      node.getChild(mdTerms.NotaBlockContent)?.getChildren(mdTerms.NotaBlockAttribute) || [];
    let blockAttrKvs = blockAttrs.map(node => this.translateNotaBlockAttribute(node));
    if (blockAttrs.length > 0) attrExprs.push(t.objectExpression(blockAttrKvs));

    let attrs =
      attrExprs.length > 1
        ? t.objectExpression(attrExprs.map(expr => t.spreadElement(expr)))
        : attrExprs.length == 1
        ? attrExprs[0]
        : t.objectExpression([]);

    let args: (Expression | SpreadElement)[] = [];
    let inlineNode = node.getChild(mdTerms.NotaInlineContent);
    if (inlineNode) args = args.concat(this.translateNotaInlineContent(inlineNode));

    let child;
    if ((child = node.getChild(mdTerms.NotaVerbatimContent))) {
      args.push(strLit(this.text(child)));
    } else {
      let blockNode = node.getChild(mdTerms.Document) || node.getChild(mdTerms.NotaBlockContent);
      if (blockNode) {
        args.push(t.spreadElement(this.translateInlineOrBlockSequence(blockNode)));
      }
    }

    let expr = t.callExpression(createEl, [name, attrs, ...args]);
    return this.spanned(expr, node);
  }

  translateNotaTemplate(node: SyntaxNode): Expression {
    assert(matches(node, jsTerms.NotaTemplate));

    let children = collectSiblings(node.firstChild);
    let childExprs = children.map(child => {
      if (matches(child, jsTerms.NotaTemplateLiteral)) {
        return strLit(this.text(child));
      } else {
        assert(matches(child, jsTerms.NotaTemplateCommand));
        let nameNode = child.getChild(jsTerms.NotaCommandName)!;
        let nameExpr = this.translateNotaCommandName(nameNode, jsTerms);
        let args = child.getChildren(jsTerms.NotaCommandArg);
        if (args.length == 0) {
          return nameExpr;
        } else {
          return t.callExpression(
            nameExpr,
            args.map(arg => this.translateNotaTemplate(arg.getChild(jsTerms.NotaTemplate)!))
          );
        }
      }
    });

    return this.spanned(t.arrayExpression(childExprs), node);
  }

  translateJsPattern(node: SyntaxNode): PatternLike {
    switch (node.type.id) {
      case jsTerms.VariableDefinition: {
        return this.ident(node);
      }

      case jsTerms.ArrayPattern: {
        // TODO: getting a weird type error around PatternLike
        let elements: any = node.getChildren(jsTerms.SpreadablePatternAssign).map(child => {
          let patternAssign = child.getChild(jsTerms.PatternAssign)!;
          if (child.getChild(jsTerms.Spread)) {
            return t.restElement(this.translateJsLval(patternAssign));
          } else {
            return this.translateJsPattern(patternAssign);
          }
        });
        return t.arrayPattern({ elements });
      }

      case jsTerms.PatternAssign: {
        let left = this.translateJsPattern(node.firstChild!) as any;
        if (node.getChild(jsTerms.Equals)) {
          let right = this.translateJsExpr(node.lastChild!);
          return t.assignmentPattern({ left, right });
        } else {
          return left;
        }
      }

      case jsTerms.ObjectPattern: {
        let properties = node.getChildren(jsTerms.PatternProperty).map(child => {
          let spread;
          if ((spread = child.getChild(jsTerms.PatternAssign))) {
            return t.restElement(this.translateJsLval(spread));
          } else {
            let keyNode = child.firstChild!;
            let key = matches(keyNode, jsTerms.PropertyName)
              ? this.ident(keyNode)
              : this.translateJsExpr(keyNode);

            // TODO: very not confident in this code
            let aliasNode = child.getChild(jsTerms.PatternPropertyAlias);
            let value = aliasNode ? this.translateJsPattern(aliasNode.lastChild!) : key;
            let defaultNode = child.getChild(jsTerms.PatternPropertyDefault);
            if (defaultNode) {
              let right = this.translateJsExpr(defaultNode.lastChild!);
              value = t.assignmentPattern({ left: value as any, right });
            }

            return t.objectProperty({
              key,
              value,
              shorthand: aliasNode === null,
            });
          }
        });
        return t.objectPattern(properties);
      }

      default:
        throw new Error(`Not yet implemented JS pattern: ${node.name}`);
    }
  }

  translateJsLval(node: SyntaxNode): LVal {
    switch (node.type.id) {
      case jsTerms.VariableDefinition:
        return this.ident(node);

      case jsTerms.ArrayPattern:
      case jsTerms.ObjectPattern:
      case jsTerms.PatternAssign:
        return this.translateJsPattern(node);

      case jsTerms.MemberExpression:
        return this.translateJsExpr(node) as LVal;

      default:
        throw new Error(`Not yet implemented JS lval: ${node.name}`);
    }
  }

  private extractDelimited(
    node: SyntaxNode,
    ignore: number[] = [
      jsTerms.Lparen,
      jsTerms.Rparen,
      jsTerms.Lbracket,
      jsTerms.Rbracket,
      jsTerms.Lbrace,
      jsTerms.Rbrace,
      jsTerms.Comma,
      jsTerms.LineComment,
      jsTerms.BlockComment,
    ]
  ) {
    return collectSiblings(node.firstChild).filter(child =>
      _.every(ignore, id => !matches(child, id))
    );
  }

  translateJsString(node: SyntaxNode): StringLiteral {
    assert(matches(node, jsTerms.String));
    return strLit(this.text(node).slice(1, -1));
  }

  translateJsProperty(node: SyntaxNode): ObjectProperty | SpreadElement {
    assert(matches(node, jsTerms.Property));

    let child = node.firstChild!;
    if (matches(child, jsTerms.FunctionProperty)) {
      throw new Error("TODO");
    } else if (matches(child, jsTerms.SpreadProperty)) {
      let expr = this.translateJsExpr(child.lastChild!);
      return t.spreadElement(expr);
    } else if (matches(child, jsTerms.ExpressionProperty)) {
      let keyNode = child.getChild(jsTerms.PropName)!.firstChild!;
      let key;
      let computed = false;
      if (matches(keyNode, jsTerms.PropertyDefinition)) {
        key = this.ident(keyNode);
      } else if (matches(keyNode, jsTerms.BracketedPropName)) {
        computed = true;
        key = this.translateJsExpr(keyNode.firstChild!.nextSibling!);
      } else {
        key = this.translateJsExpr(keyNode);
      }

      let grandchild, value;
      if ((grandchild = child.getChild(jsTerms.Colon))) {
        value = this.translateJsExpr(grandchild.nextSibling!);
      } else {
        value = key;
      }

      return t.objectProperty({ key, value, computed });
    } else {
      unreachable();
    }
  }

  translateJsExpr(node: SyntaxNode): Expression {
    let expr: Expression;
    switch (node.type.id) {
      case jsTerms.Number: {
        expr = t.numericLiteral(parseInt(this.text(node)));
        break;
      }

      case jsTerms.String: {
        expr = this.translateJsString(node);
        break;
      }

      case jsTerms.VariableName: {
        expr = this.ident(node);
        break;
      }

      case jsTerms.Boolean: {
        expr = t.booleanLiteral(this.text(node) == "true");
        break;
      }

      case jsTerms.FunctionExpression: {
        let child, id;
        if ((child = node.getChild(jsTerms.VariableDefinition))) {
          id = this.ident(child);
        } else {
          id = null;
        }
        let params = this.extractDelimited(node.getChild(jsTerms.ParamList)!).map(node =>
          this.translateJsLval(node)
        );
        let body = this.translateJsBlock(node.getChild(jsTerms.Block)!);
        expr = t.functionExpression(id, params as any[], body);
        break;
      }

      case jsTerms.ArrowFunction: {
        let params = this.extractDelimited(node.getChild("ParamList")!).map(node =>
          this.translateJsLval(node)
        );

        let child = node.getChild(jsTerms.Arrow)!.nextSibling!;
        let body = matches(child, jsTerms.Block)
          ? this.translateJsBlock(child)
          : this.translateJsExpr(child);

        expr = t.arrowFunctionExpression(params as any[], body);
        break;
      }

      case jsTerms.CallExpression: {
        let func = this.translateJsExpr(node.firstChild!);
        let args = this.extractDelimited(node.getChild(jsTerms.ArgList)!).map(node =>
          this.translateJsExpr(node)
        );
        expr = t.callExpression(func, args);
        break;
      }

      case jsTerms.MemberExpression: {
        let l = this.translateJsExpr(node.firstChild!);
        let rNode = node.lastChild!;
        let r = matches(rNode, jsTerms.ObjectBracket)
          ? this.translateJsExpr(rNode.firstChild!.nextSibling!)
          : this.ident(rNode);
        expr = t.memberExpression(l, r);
        break;
      }

      case jsTerms.ArrayExpression: {
        let elements = this.extractDelimited(node).map(elem => {
          if (matches(elem, jsTerms.SpreadProperty)) {
            let expr = this.translateJsExpr(elem.lastChild!);
            return t.spreadElement(expr);
          } else {
            return this.translateJsExpr(elem);
          }
        });
        expr = t.arrayExpression(elements);
        break;
      }

      case jsTerms.ObjectExpression: {
        let properties = node
          .getChildren(jsTerms.Property)
          .map(node => this.translateJsProperty(node));
        expr = t.objectExpression(properties);
        break;
      }

      case jsTerms.NewExpression: {
        let callee = this.translateJsExpr(node.firstChild!.nextSibling!);
        let args = this.extractDelimited(node.getChild(jsTerms.ArgList)!).map(node =>
          this.translateJsExpr(node)
        );
        expr = t.newExpression({ callee, args });
        break;
      }

      case jsTerms.ParenthesizedExpression: {
        expr = this.translateJsExpr(node.firstChild!.nextSibling!);
        break;
      }

      case jsTerms.UnaryExpression: {
        let argument = this.translateJsExpr(node.lastChild!);
        let operator = this.text(node.firstChild!);
        expr = t.unaryExpression({ argument, operator });
        break;
      }

      case jsTerms.BinaryExpression: {
        let left = this.translateJsExpr(node.firstChild!);
        let right = this.translateJsExpr(node.lastChild!);
        let operator = this.text(node.firstChild!.nextSibling!);
        expr = t.binaryExpression({ left, right, operator });
        break;
      }

      case jsTerms.ConditionalExpression: {
        let child = node.firstChild!;
        let test = this.translateJsExpr(child);
        child = child.nextSibling!.nextSibling!;
        let consequent = this.translateJsExpr(child);
        child = child.nextSibling!.nextSibling!;
        let alternate = this.translateJsExpr(child);
        expr = t.conditionalExpression({ test, consequent, alternate });
        break;
      }

      case jsTerms.AssignmentExpression: {
        let leftNode = node.firstChild!;
        let rightNode = leftNode.nextSibling!.nextSibling!;
        let left = this.translateJsLval(leftNode);
        let right = this.translateJsExpr(rightNode);
        expr = t.assignmentExpression({ left, right });
        break;
      }

      case jsTerms.This: {
        expr = t.thisExpression();
        break;
      }

      case jsTerms.Null: {
        expr = t.nullLiteral();
        break;
      }

      case jsTerms.Super: {
        expr = t.superExpression();
        break;
      }

      case jsTerms.TemplateString: {
        let interpolations = node.getChildren(jsTerms.Interpolation);
        let pos = node.from + 1;
        let end = node.to - 1;
        let quasis: TemplateElement[] = [];
        let expressions: Expression[] = [];

        let addQuasi = (end: number, tail: boolean = false) => {
          let text = this.input.slice(pos, end);
          quasis.push(t.templateElement({ raw: text, cooked: text, tail }));
        };

        interpolations.forEach(interp => {
          if (pos < interp.from) addQuasi(interp.from);
          pos = interp.to;

          let expr = this.translateJsExpr(interp.firstChild!.nextSibling!);
          expressions.push(expr);
        });

        addQuasi(end, true);

        expr = t.templateLiteral({ quasis, expressions });
        break;
      }

      case jsTerms.NotaMacro: {
        let template = node.getChild(jsTerms.NotaTemplate)!;
        let args = t.identifier("args");
        expr = t.arrowFunctionExpression(
          [t.restElement(args)],
          this.translateNotaTemplate(template)
        );
        break;
      }

      case mdTerms.Document: {
        let child = node.firstChild!;
        if (matches(child, mdTerms.NotaBlockComponent)) {
          expr = this.translateNotaBlockComponent(child);
        } else if (matches(child, mdTerms.Paragraph)) {
          let grandchild = child.firstChild!;
          if (matches(grandchild, mdTerms.NotaInterpolation)) {
            expr = this.translateNotaInterpolation(grandchild);
          } else if (matches(grandchild, mdTerms.NotaInlineComponent)) {
            expr = this.translateNotaInlineComponent(grandchild);
          } else {
            console.warn(`Unexpected Nota inside JS of type: ${grandchild.name}`);
            expr = t.nullLiteral();
          }
        } else {
          console.warn(`Unexpected Nota inside JS of type: ${child.name}`);
          expr = t.nullLiteral();
        }
        break;
      }

      default:
        throw new Error(`Not yet implemented JS expr: ${node.name}`);
    }

    return this.spanned(expr, node);
  }

  translateJsBlock(node: SyntaxNode): BlockStatement {
    assert(matches(node, jsTerms.Block));
    let stmts = this.extractDelimited(node).map(node => this.translateJsStmt(node));
    return t.blockStatement(stmts);
  }

  translateJsDeclaration(node: SyntaxNode): Declaration {
    switch (node.type.id) {
      case jsTerms.VariableDeclaration: {
        let child = node.firstChild;
        let kind = this.text(child!) as "let" | "var" | "const";
        child = child!.nextSibling;
        let declarators = [];
        while (child && this.text(child) != ";") {
          let lval = this.translateJsLval(child!);
          child = child.nextSibling;
          let expr = undefined;
          if (child && matches(child, jsTerms.Equals)) {
            child = child.nextSibling;
            expr = this.translateJsExpr(child!);
            child = child!.nextSibling;
          }
          declarators.push(t.variableDeclarator(lval, expr));
        }
        return t.variableDeclaration(kind, declarators);
      }

      default: {
        throw new Error(`Not yet implemented JS declaration: ${node.name}`);
      }
    }
  }

  translateJsImportDeclaration(node: SyntaxNode): ImportDeclaration {
    assert(matches(node, jsTerms.ImportDeclaration));
    let child = node.firstChild!;
    let specifiers: (ImportNamespaceSpecifier | ImportDefaultSpecifier | ImportSpecifier)[] = [];
    if (matches(child, jsTerms.ImportSymbols)) {
      let grandchild;
      if ((grandchild = child.getChild(jsTerms.ImportNamespaceSpecifier))) {
        let local = this.ident(grandchild.getChild(jsTerms.VariableDefinition)!);
        specifiers.push(t.importNamespaceSpecifier({ local }));
      } else {
        let defaultSpecifiers = child
          .getChildren(jsTerms.ImportDefaultSpecifier)
          .map(node => t.importDefaultSpecifier(this.ident(node)));

        let namedSpecifiers = child
          .getChildren(jsTerms.ImportSpecifier)
          .map(node => {
            return this.extractDelimited(node).map(imprt => {
              if (matches(imprt, jsTerms.AliasedImport)) {
                let importedNode = imprt.firstChild!;
                let imported = matches(importedNode, jsTerms.String)
                  ? this.translateJsString(importedNode)
                  : this.ident(importedNode);
                let local = this.ident(imprt.getChild(jsTerms.VariableDefinition)!);
                return t.importSpecifier(local, imported);
              } else {
                let local = this.ident(imprt);
                return t.importSpecifier(local, local);
              }
            });
          })
          .flat();

        specifiers = specifiers.concat(defaultSpecifiers).concat(namedSpecifiers);
      }
    }
    let source = this.translateJsString(node.firstChild!.getChild(jsTerms.String)!);
    return t.importDeclaration(specifiers, source);
  }

  translateJsExportDeclaration(node: SyntaxNode): ExportDeclaration {
    let child = node.firstChild!;
    switch (child.type.id) {
      case jsTerms.ExportNamedDeclaration: {
        let decl = this.translateJsDeclaration(child.lastChild!);
        return t.exportNamedDeclaration(decl);
      }

      default: {
        throw new Error(`Not yet implemented JS export declaration: ${node.name}`);
      }
    }
  }

  translateJsStmt(node: SyntaxNode): Statement {
    switch (node.name) {
      case "VariableDeclaration":
      case "FunctionDeclaration":
      case "ClassDeclaration": {
        return this.translateJsDeclaration(node);
      }

      case "ExpressionStatement": {
        let expr = this.translateJsExpr(node.firstChild!);
        return t.expressionStatement(expr);
      }

      case "ImportDeclaration": {
        return this.translateJsImportDeclaration(node);
      }

      case "ExportDeclaration": {
        return this.translateJsExportDeclaration(node);
      }

      case "ThrowStatement": {
        let argument = this.translateJsExpr(node.firstChild!.nextSibling!);
        return t.throwStatement({ argument });
      }

      case "ReturnStatement": {
        let argument = this.translateJsExpr(node.firstChild!.nextSibling!);
        return t.returnStatement(argument);
      }

      default:
        throw new Error(`Not yet implemented JS stmt: ${node.name}`);
    }
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
    t.objectExpression(
      props.map(p => (p instanceof Array ? t.objectProperty({ key: p[0], value: p[1] }) : p))
    ),
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
      } else {
        let changed = false;
        let newProps = props
          .map(e => {
            if (e.type == "SpreadElement" && e.argument.type == "ObjectExpression") {
              changed = true;
              return e.argument.properties;
            } else {
              return [e];
            }
          })
          .flat();
        if (changed) {
          path.replaceWith(t.objectExpression(newProps));
        }
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

export let translateAst = ({ input, tree, debugExports, extraCss }: TranslateOptions): Program => {
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

  let jsImportStmts = [
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
  ];

  let preludeImportStmts = _.toPairs(preludeImports).map(([mod, ks]) =>
    t.variableDeclaration("const", [
      t.variableDeclarator(
        t.objectPattern(
          ks.map(k =>
            t.objectProperty({ key: t.identifier(k), value: t.identifier(k), shorthand: true })
          )
        ),
        t.identifier(mod)
      ),
    ])
  );

  let cssFiles = ["@nota-lang/nota-components/dist/index.css"].concat(extraCss || []);
  let cssImportStmts = cssFiles.map(s => t.importDeclaration([], strLit(s)));

  let defaultExport = t.exportDefaultDeclaration(
    t.callExpression(observer, [
      // Give this a name for more informative React errors
      t.functionExpression(
        t.identifier("TheDocument"),
        [docProps],
        t.blockStatement([t.returnStatement(doc)])
      ),
    ])
  );

  let imports: { [key: string]: boolean } = {};
  translator.imports.forEach(decl => {
    let src = decl.source.value;
    if (!(src in imports)) {
      imports[src] = false;
    }

    if (_.some(decl.specifiers, spec => spec.type == "ImportDefaultSpecifier")) {
      imports[src] = true;
    }
  });
  let importModules = Object.keys(imports);

  let debugImports = importModules.map((mod, i) => {
    let decls: any[] = [t.importNamespaceSpecifier({ local: t.identifier(`import${i}`) })];
    if (imports[mod]) {
      decls.unshift(t.importDefaultSpecifier(t.identifier(`import${i}_default`)));
    }
    return t.importDeclaration(decls, strLit(mod));
  });
  let debugImportExport = t.exportNamedDeclaration(
    t.variableDeclaration("let", [
      t.variableDeclarator(
        t.identifier("imports"),
        t.objectExpression(
          importModules.map((mod, i) => {
            let value = t.objectExpression([
              t.spreadElement(t.identifier(`import${i}`)),
              t.objectProperty({
                key: strLit("__esModule"),
                value: t.booleanLiteral(true),
              }),
            ]);

            if (imports[mod]) {
              value.properties.push(
                t.objectProperty({
                  key: strLit("default"),
                  value: t.identifier(`import${i}_default`),
                })
              );
            }

            return t.objectProperty({ key: strLit(mod), value });
          })
        )
      ),
    ])
  );
  let debugSourceExport = t.exportNamedDeclaration(
    t.variableDeclaration("let", [t.variableDeclarator(t.identifier("source"), strLit(input))])
  );

  let program: Statement[] = [
    ...jsImportStmts,
    ...cssImportStmts,
    ...preludeImportStmts,
    ...Array.from(translator.imports),
    ...(debugExports ? debugImports : []),
    ...Array.from(translator.exports),
    ...(debugExports ? [debugImportExport, debugSourceExport] : []),
    defaultExport,
  ];

  return t.program(program);
};

export let treeToString = (tree: Tree, contents: string): string => {
  let depth = (node: any): number => (node.parent ? 1 + depth(node.parent) : 0);
  let cursor = tree.cursor();
  let output = [];
  do {
    let subInput = contents.slice(cursor.from, cursor.to);
    if (subInput.length > 30) {
      subInput = subInput.slice(0, 12) + "..." + subInput.slice(-12);
    }
    subInput = subInput.replace("\n", "\\n");
    output.push(indentString(`${cursor.name}: "${subInput}"`, 2 * depth(cursor.node)));
  } while (cursor.next());

  return output.join("\n");
};

export let printTree = (tree: Tree, contents: string) => {
  console.log(treeToString(tree, contents));
};

export interface TranslateOptions {
  input: string;
  tree: Tree;
  inputPath?: string;
  debugExports?: boolean;
  extraCss?: string[];
}

export let translate = (opts: TranslateOptions): { code: string; map?: any } => {
  let sourceRoot, filenameRelative;
  let inputPath = opts.inputPath;
  if (inputPath) {
    let { dir, base } = path.parse(inputPath);
    sourceRoot = dir;
    filenameRelative = base;
  }

  // printTree(tree, input);
  let program = translateAst(opts);
  let result = babel.transformFromAst(program, undefined, {
    sourceRoot,
    filenameRelative,
    sourceMaps: inputPath ? true : undefined,
    plugins: [optimizePlugin],
  }) as any as BabelFileResult;

  let code = result.code;
  if (!code) {
    throw new Error("No code generated by Babel!");
  }

  let map = result.map;
  if (map) {
    if (inputPath) map.sources.push(inputPath + ".js");
    map.sourcesContent?.push(code);
  }

  return { code, map };
};

let collectSiblings = (arg: SyntaxNode | null): SyntaxNode[] => {
  let args = [];
  while (arg != null) {
    args.push(arg);
    arg = arg.nextSibling;
  }
  return args;
};
