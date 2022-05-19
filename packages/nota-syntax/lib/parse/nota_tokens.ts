import { ExternalTokenizer } from "@lezer/lr";

//@ts-ignore
import { Markdown } from "./notajs.grammar.terms.js";

const [atSign, lbrc, rbrc] = ["@", "{", "}"].map(s => s.charCodeAt(0));
const eof = -1;

export const markdown = new ExternalTokenizer((input, _stack) => {
  if (input.next != atSign) return;

  while (input.next != lbrc && input.next != eof) {
    input.advance();
  }
  input.advance();

  let balance = 1;
  while (input.next != eof && balance > 0) {
    if (input.next == lbrc) balance++;
    else if (input.next == rbrc) balance--;
    input.advance();
  }

  input.acceptToken(Markdown);
});
