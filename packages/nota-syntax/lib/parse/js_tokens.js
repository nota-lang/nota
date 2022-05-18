import { ExternalTokenizer, ContextTracker } from "@lezer/lr";
import {
  insertSemi,
  noSemi,
  incdec,
  incdecPrefix,
  templateContent,
  InterpolationStart,
  templateEnd,
  spaces,
  newline,
  BlockComment,
  LineComment,
  TSExtends,
  Dialect_ts,
} from "./notajs.grammar.terms.js";

const space = [
  9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201,
  8202, 8232, 8233, 8239, 8287, 12288,
];

const braceR = 125,
  braceL = 123,
  semicolon = 59,
  slash = 47,
  star = 42,
  plus = 43,
  minus = 45,
  dollar = 36,
  backtick = 96,
  backslash = 92;

export const trackNewline = new ContextTracker({
  start: false,
  shift(context, term) {
    return term == LineComment || term == BlockComment || term == spaces
      ? context
      : term == newline;
  },
  strict: false,
});

export const insertSemicolon = new ExternalTokenizer(
  (input, stack) => {
    let { next } = input;
    if ((next == braceR || next == -1 || stack.context) && stack.canShift(insertSemi))
      input.acceptToken(insertSemi);
  },
  { contextual: true, fallback: true }
);

export const noSemicolon = new ExternalTokenizer(
  (input, stack) => {
    let { next } = input,
      after;
    if (space.indexOf(next) > -1) return;
    if (next == slash && ((after = input.peek(1)) == slash || after == star)) return;
    if (
      next != braceR &&
      next != semicolon &&
      next != -1 &&
      !stack.context &&
      stack.canShift(noSemi)
    )
      input.acceptToken(noSemi);
  },
  { contextual: true }
);

export const incdecToken = new ExternalTokenizer(
  (input, stack) => {
    let { next } = input;
    if (next == plus || next == minus) {
      input.advance();
      if (next == input.next) {
        input.advance();
        let mayPostfix = !stack.context && stack.canShift(incdec);
        input.acceptToken(mayPostfix ? incdec : incdecPrefix);
      }
    }
  },
  { contextual: true }
);

export const template = new ExternalTokenizer(input => {
  for (let afterDollar = false, i = 0; ; i++) {
    let { next } = input;
    if (next < 0) {
      if (i) input.acceptToken(templateContent);
      break;
    } else if (next == backtick) {
      if (i) input.acceptToken(templateContent);
      else input.acceptToken(templateEnd, 1);
      break;
    } else if (next == braceL && afterDollar) {
      if (i == 1) input.acceptToken(InterpolationStart, 1);
      else input.acceptToken(templateContent, -1);
      break;
    } else if (next == 10 /* "\n" */ && i) {
      // Break up template strings on lines, to avoid huge tokens
      input.advance();
      input.acceptToken(templateContent);
      break;
    } else if (next == backslash) {
      input.advance();
    }
    afterDollar = next == dollar;
    input.advance();
  }
});

export function tsExtends(value, stack) {
  return value == "extends" && stack.dialectEnabled(Dialect_ts) ? TSExtends : -1;
}
