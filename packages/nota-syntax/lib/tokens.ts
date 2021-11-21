import { ExternalTokenizer, ContextTracker } from "@lezer/lr";
//@ts-ignore
import * as terms from "./nota.terms";
import _ from "lodash";

const [lbrc, rbrc, lbrkt, rbrkt, at_sign, pct_sign, hash_sign, newline, backslash, pipe, eqsign] = [
  "{",
  "}",
  "[",
  "]",
  "@",
  "%",
  "#",
  "\n",
  "\\",
  "|",
  "="
].map(s => s.charCodeAt(0));
const eof = -1;

const _term_name = (n: number) => Object.keys(terms).find(k => terms[k] == n);

export const dialectContext = new ContextTracker<
  (({ ignore: boolean } | { balance: boolean }) & { parent: any }) | null
>({
  start: null,
  strict: false,
  shift(context, term, _stack, _input) {
    // console.log(`shift ${_term_name(term)} at ${String.fromCharCode(input.next)} (${input.pos}) in context ${JSON.stringify(context)}`);    
    if (context != null) {
      if (term == terms.eq || term == terms.lbrc) {
        return { balance: true, parent: context }
      } else if ((term == terms.rbrkt && context.parent) || term == terms.rbrc) {
        return context.parent;
      }  
    }
    return context;
  },
  reduce(context, term, _stack, _input) {
    // console.log(`reduce ${_term_name(term)} at ${String.fromCharCode(input.next)} (${input.pos}) in context ${JSON.stringify(context)}`);
    if (term == terms.CommandSigil) {
      return { ignore: true, parent: context };
    } else if (context && term == terms.Command) {
      return context.parent;
    }

    return context;
  },
  reuse(context, _node) {
    // console.log('reuse', node.type.name);
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
          input.acceptToken(terms.Text);
        }
        return;
      }

      if (stack.context != null) {
        if (stack.context.ignore && (input.next == pipe || input.next == eqsign || ldelims.includes(input.next))) {
          if (len > 0) {
            input.acceptToken(terms.Text);
          }
          return;
        } else if (stack.context.balance) {
          if (ldelims.includes(input.next)) {
            balance[input.next]++;
          } else if (rdelims.includes(input.next)) {
            let l = r2l[input.next];
            if (balance[l] == 0) {
              if (len > 0) {
                input.acceptToken(terms.Text);
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

export const verbatim = new ExternalTokenizer(input => {
  let saw_brace = false;
  while (input.next != eof) {
    if (input.next == lbrc) {
      saw_brace = true;
    } else if (input.next == pipe && saw_brace) {
      input.acceptToken(terms.VerbatimText, -1);
      return;
    }

    input.advance();
  }
});
