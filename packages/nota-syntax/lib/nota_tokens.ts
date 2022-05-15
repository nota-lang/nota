import { ExternalTokenizer } from "@lezer/lr";

//@ts-ignore
import { Markdown } from "./nota.grammar.terms.js";

const [lbrc, rbrc] = ["{", "}"].map(s => s.charCodeAt(0));
const eof = -1;

export const markdown = new ExternalTokenizer((input, _stack) => {
  let balance = 0;
  for (let len = 0; input.next != eof; len++) {
    if (input.next == lbrc) {
      balance++;
    } else if (input.next == rbrc) {
      if (balance == 0) {
        if (len > 0) {
          input.acceptToken(Markdown);
        }
        return;
      }
      balance--;
    }
    input.advance();
  }
});
