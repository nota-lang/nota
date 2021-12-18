import type { SyntaxNode } from "@lezer/common";
import type { Expression } from "@babel/types";
import { assert } from "@wcrichto/nota-common";
import * as babel from "@babel/standalone";
import _ from "lodash";

//@ts-ignore
import * as nota_terms from "../nota/nota.grammar";
//@ts-ignore
import * as terms from "./javascript.grammar";
import * as t from "../babel-polyfill";
import { matches, text, translate_textbody, parse_expr, lambda } from "../nota/translate";
import { BabelFileResult } from "@babel/core";

export let translate_js = (node: SyntaxNode): Expression => {
  assert(matches(node, terms.Script));

  let cursor = node.cursor;
  let replacements: [number, number, string][] = [];
  while (node.from <= cursor.from && cursor.to <= node.to) {
    if (matches(cursor.node, terms.NotaMacroWrap)) {
      let doc = cursor.node.getChild(nota_terms.Document)!;
      let expr = translate_textbody(doc.firstChild!); 

      let name_node = cursor.node.getChild(terms.Label);
      if (name_node) {
        let name = text(name_node);
        if (name == "fn") {
          expr = lambda(expr);
        } else {
          throw `Unknown @-macro ${name}`;
        }
      }

      let result = babel.transformFromAst(
        t.program([t.expressionStatement(expr)]),
        undefined,
        {}
      ) as any as BabelFileResult;
      let code = result.code!.slice(0, -1);
      replacements.push([cursor.from - node.from, cursor.to - node.from, code]);
      cursor.next(false);
    } else if (!cursor.next()) {
      break;
    }
  }

  let code = text(node);
  replacements = _.sortBy(replacements, [0]);
  let expanded = "";
  let i = 0;
  replacements.forEach(([from, to, expr]) => {
    expanded += code.slice(i, from);
    expanded += expr;
    i = to;
  });
  expanded += code.slice(i);

  // console.log('Translated', code, 'to', expanded);

  return parse_expr(expanded);
};
