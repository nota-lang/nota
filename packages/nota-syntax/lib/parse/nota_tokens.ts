// @ts-nocheck
// TODO: only reason nocheck is here is because we can't @ts-ignore the multiline
// block of notajs.grammar.terms.js imports. See:
// https://stackoverflow.com/questions/51145180/how-to-use-ts-ignore-for-a-block
import { ExternalTokenizer, InputStream, Stack } from "@lezer/lr";

import {
  Lbrace,
  NotaCommand,
  NotaCommandArg,
  NotaTemplateLiteral,
} from "./notajs.grammar.terms.js";

const [atSign, hash, lbrc, rbrc, lbrkt, rbrkt] = ["@", "#", "{", "}", "[", "]"].map(s =>
  s.charCodeAt(0)
);
const eof = -1;

/* TODO: LEAVE A COMMENT DOCUMENTING THIS DUMB ARCHITECTURE */

export let handleShift = (
  context: any,
  term: number,
  stack: Stack,
  input: InputStream
): any | null => {
  if (term == Lbrace) {
    return { ...context, templateBraceBalance: [...context.templateBraceBalance, 0] };
  } else if (term == NotaTemplateLiteral) {
    let balance = 0;
    for (let i = 0; i < stack.pos - input.pos; ++i) {
      let chr = input.peek(i);
      if (chr == lbrc) ++balance;
      else if (chr == rbrc) --balance;
    }

    let last = context.templateBraceBalance.length - 1;
    return {
      ...context,
      templateBraceBalance: [
        ...context.templateBraceBalance.slice(0, -1),
        context.templateBraceBalance[last] + balance,
      ],
    };
  }

  return null;
};

export let handleReduce = (context: any, term: number): any | null => {
  if (term == NotaCommandArg) {
    return { ...context, templateBraceBalance: context.templateBraceBalance.slice(0, -1) };
  }

  return null;
};

export const notaTemplateLiteral = new ExternalTokenizer(
  (input, stack) => {
    // in a case like
    //   ... #foo{}
    //           ^- cursor
    // then we stop tokenizing if we could shift an lbrace for the arg
    if (stack.canShift(Lbrace) && input.next == lbrc) return;

    let ctx = stack.context;
    let last = ctx.templateBraceBalance.length - 1;
    let balance = ctx.templateBraceBalance[last];

    let len = 0;
    while (input.next != eof && input.next != hash) {
      if (input.next == lbrc) ++balance;
      else if (input.next == rbrc) {
        if (balance == 0) break;
        else --balance;
      }
      input.advance();
      ++len;
    }

    if (len > 0) input.acceptToken(NotaTemplateLiteral);
  },
  { contextual: true }
);

export const notaCommand = new ExternalTokenizer((input, _stack) => {
  if (input.next != atSign) return;

  while (![lbrc, lbrkt, eof].includes(input.next)) input.advance();

  let brcBalance = 0;
  let brktBalance = 0;
  do {
    if (input.next == lbrc) brcBalance++;
    else if (input.next == rbrc) brcBalance--;
    else if (input.next == lbrkt) brktBalance++;
    else if (input.next == rbrkt) brktBalance--;
    input.advance();
  } while (
    input.next != eof &&
    (brcBalance + brktBalance > 0 || [lbrc, lbrkt].includes(input.next))
  );

  input.acceptToken(NotaCommand);
});
