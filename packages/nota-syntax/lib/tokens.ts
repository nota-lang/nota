import { ExternalTokenizer, ContextTracker } from "@lezer/lr";
//@ts-ignore
import * as terms from "./nota.terms";
import _ from "lodash";

const [lbrc, rbrc, lbrkt, rbrkt, at_sign, pct_sign, hash_sign, newline, backslash] = [
  "{",
  "}",
  "[",
  "]",
  "@",
  "%",
  "#",
  "\n",
  "\\",
].map(s => s.charCodeAt(0));
const eof = -1;

const {
  Text,
  startDelimited,
  stopDelimited,
  startExpectingDelimiter,
  stopExpectingDelimiter,
} = terms;
const _term_name = (n: number) => Object.keys(terms).find(k => terms[k] == n);

export const dialectContext = new ContextTracker<
  (({ ignore: boolean } | { balance: boolean }) & { parent: any }) | null
>({
  start: null,
  strict: false,
  shift(context) {
    return context;
  },
  reduce(context, term) {
    if (term == startExpectingDelimiter) {
      return { ignore: true, parent: context };
    } else if (term == stopExpectingDelimiter) {
      return context!.parent;
    } else if (term == startDelimited) {
      return { balance: true, parent: context };
    } else if (term == stopDelimited) {
      return context!.parent;
    }

    return context;
  },
  reuse(context) {
    return context;
  },
  hash(_context) {
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
        input.next == newline ||
        input.next == hash_sign ||
        input.next == at_sign ||
        input.next == pct_sign
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

      if (input.next == backslash) {
        input.advance();
        if (input.next == hash_sign || input.next == at_sign || input.next == pct_sign) {
          input.advance();
        }
      } else {
        input.advance();
      }
    }
  },
  { contextual: true }
);
