import { SyntaxNode, parseMixed } from "@lezer/common";
import type { LRParser } from "@lezer/lr";
import type { Expression } from "@babel/types";
import { assert } from "@nota-lang/nota-common";
import * as babel from "@babel/standalone";
import _ from "lodash";

//@ts-ignore
import * as nota_terms from "../nota/nota.grammar";
//@ts-ignore
import * as terms from "./javascript.grammar";
import * as t from "../babel-polyfill";
import {
  matches,
  text,
  translate_atcommand,
  parse_expr,
  lambda,
  nota_parser,
} from "../nota/translate";
import { BabelFileResult } from "@babel/core";

export let js_wrap = (nota_parser: () => LRParser) =>
  parseMixed((node, _input) => {
    if (node.type.id == terms.NotaMacro) {
      return { parser: nota_parser() };
    }
    return null;
  });

export let js_parser: LRParser = terms.parser.configure({ wrap: js_wrap(() => nota_parser) });

export let translate_js = (node: SyntaxNode): Expression => {
  assert(matches(node, terms.Script));

  let cursor = node.cursor;
  let replacements: [number, number, string][] = [];
  while (node.from <= cursor.from && cursor.to <= node.to) {
    if (matches(cursor.node, nota_terms.Document)) {
      let cmd = cursor.node
        .getChild(nota_terms.TextBody)!
        .getChild(nota_terms.TextToken)!
        .getChild(nota_terms.Command)!
        .getChild(nota_terms.AtCommand)!;

      let expr = translate_atcommand(cmd);
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
