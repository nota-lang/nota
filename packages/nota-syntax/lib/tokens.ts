import { ExternalTokenizer, ContextTracker } from "@lezer/lr";
//@ts-ignore
import * as terms from "./nota.terms";
import _ from "lodash";

const [lparen, rparen, lbrc, rbrc, lbrkt, rbrkt, at_sign, pct_sign, hash_sign, newline, space] = [
  "(",
  ")",
  "{",
  "}",
  "[",
  "]",
  "@",
  "%",
  "#",
  "\n",
  " ",
].map(s => s.charCodeAt(0));
const eof = -1;

const {
  Text,
  startDelimited,
  stopDelimited,
  startExpectingDelimiter,
  stopExpectingDelimiter,
  startIgnoreText,
  stopIgnoreText,
} = terms;
const term_name = n => Object.keys(terms).find(k => terms[k] == n);

export const dialectContext = new ContextTracker({
  start: null,
  strict: false,
  shift(context, term, stack, input) {
    // console.log('shift', term_name(term))
    return context;
  },
  reduce(context, term, stack, input) {
    // console.log('reduce', term_name(term));
    if (term == startExpectingDelimiter) {
      return { ignore: true, parent: context };
    } else if (term == stopExpectingDelimiter) {
      return context.parent;
    } else if (term == startDelimited) {
      return { balance: true, parent: context };
    } else if (term == stopDelimited) {
      return context.parent;
    }

    return context;
  },
  reuse(context, node, _stack, input) {
    return context;
  },
  hash(context) {
    return 0;
  },
});

let delims = [
  [lbrc, rbrc],
  [lbrkt, rbrkt],
];
let ldelims = delims.map(([l]) => l);
let rdelims = delims.map(([_l, r]) => r);
let r2l = _.fromPairs(delims.map(([l, r]) => [r, l]));

export const text = new ExternalTokenizer(
  (input, stack) => {
    let balance = _.fromPairs(ldelims.map(l => [l, 0]));
    for (let len = 0; ; len++) {
      // console.log(input.pos, String.fromCharCode(input.next), stack.context);
      if (
        input.next == eof ||
        input.next == at_sign ||
        input.next == pct_sign ||
        input.next == hash_sign ||
        input.next == newline
      ) {
        if (len > 0) {
          input.acceptToken(Text);
        }
        return;
      }

      if (stack.context != null) {
        if (stack.context.ignore && ldelims.includes(input.next)) {
          if (len > 0) {
            input.acceptToken(Text);
          }
          return;
        } else if (stack.context.balance) {
          if (ldelims.includes(input.next)) {
            balance[input.next]++;
          } else if (rdelims.includes(input.next)) {
            let l = r2l[input.next];
            if (balance[l] == 0) {
              if (len > 0) {
                input.acceptToken(Text);
              }
              return;
            } else {
              balance[l]--;
            }
          }
        }
      }

      input.advance();
    }
  },
  { contextual: true }
);
