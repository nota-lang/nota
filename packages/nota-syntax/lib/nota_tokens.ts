import { ExternalTokenizer, ContextTracker } from "@lezer/lr";
//@ts-ignore
import * as terms from "./nota.grammar";
import _ from "lodash";

const [
  lbrc,
  rbrc,
  lparen,
  rparen,
  lbrkt,
  rbrkt,
  at_sign,
  pct_sign,
  hash_sign,
  newline,
  fwdslash,
  backslash,
  pipe,
  eqsign,
] = ["{", "}", "(", ")", "[", "]", "@", "%", "#", "\n", "/", "\\", "|", "="].map(s =>
  s.charCodeAt(0)
);
const eof = -1;

const term_name = (n: number) => Object.keys(terms).find(k => terms[k] == n);

interface IgnoreContext {
  ignore: boolean;
}

interface BalanceContext {
  balance: { [ldelim: string]: number };
}

type TextContext = ((IgnoreContext | BalanceContext) & { parent: any }) | null;
type Context = { text: TextContext; newline: boolean };

const DEBUG = false;

export const context = new ContextTracker<Context>({
  start: { text: null, newline: false },
  strict: true,
  shift(context, term, _stack, input) {
    if (DEBUG) {
      console.log(
        `shift ${term_name(term)} at ${String.fromCharCode(input.next)} (${
          input.pos
        }) in context ${JSON.stringify(context.text)}`
      );
    }

    let newline =
      term == terms.LineComment || term == terms.BlockComment || term == terms.spaces
        ? context.newline
        : term == terms.newline;

    let text = context.text;
    if (term == terms.pct || term == terms.hash || term == terms.at) {
      text = { ignore: true, parent: text };
    } else if (text != null) {
      if (term == terms.lbrc || term == terms.lbrkt || term == terms.lparen) {
        text = { balance: _.fromPairs(ldelims.map(l => [l, 0])), parent: text };
      } else if (term == terms.rbrc || term == terms.rbrkt || term == terms.rparen) {
        text = text.parent;
      }
    }

    return { newline, text };
  },
  reduce(context, term, _stack, input) {
    if (DEBUG) {
      console.log(
        `reduce ${term_name(term)} at ${String.fromCharCode(input.next)} (${
          input.pos
        }) in context ${JSON.stringify(context.text)}`
      );
    }
    if (
      context.text &&
      (term == terms.AtCommand || term == terms.PctCommand || term == terms.HashCommand)
    ) {
      return { ...context, text: context.text.parent };
    }
    return context;
  },
  reuse(context, _node) {
    return context;
  },
  hash(_context) {
    return 0;
  },
});

export const notaNewline = new ExternalTokenizer(input => {
  if (input.next == newline) {
    input.advance();
    input.acceptToken(terms.NotaNewline);
    return;
  }
});

let delims = [
  [lbrc, rbrc],
  [lbrkt, rbrkt],
  [lparen, rparen],
];
let ldelims = delims.map(([l]) => l);
let rdelims = delims.map(([_l, r]) => r);
let r2l = _.fromPairs(delims.map(([l, r]) => [r, l]));

export const text = new ExternalTokenizer(
  (input, stack) => {
    for (let len = 0; ; len++) {
      if (input.next == fwdslash && input.peek(1) == fwdslash) {
        if (len > 0) {
          input.acceptToken(terms.Text);
        }
        return;
      }

      // console.log("text", input.pos, String.fromCharCode(input.next), stack.context);
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

      let ctx = stack.context.text;
      if (ctx != null) {
        if (
          ctx.ignore &&
          (input.next == pipe ||
            input.next == eqsign ||
            ldelims.includes(input.next) ||
            rdelims.includes(input.next))
        ) {
          if (len > 0) {
            input.acceptToken(terms.Text);
          }
          return;
        } else if (ctx.balance) {
          if (ldelims.includes(input.next)) {
            ctx.balance[input.next]++;
          } else if (rdelims.includes(input.next)) {
            let l = r2l[input.next];
            if (ctx.balance[l] == 0) {
              if (len > 0) {
                input.acceptToken(terms.Text);
              }
              return;
            } else {
              ctx.balance[l]--;
            }
          }
        }
      }

      if (input.next == backslash) {
        input.advance();
        if (input.next == hash_sign || input.next == at_sign || input.next == pct_sign) {
          len += 1;
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
    // console.log("verbatim", input.pos, String.fromCharCode(input.next));
    if (input.next == rbrc) {
      saw_brace = true;
    } else if (input.next == pipe && saw_brace) {
      input.acceptToken(terms.VerbatimText, -1);
      return;
    } else {
      saw_brace = false;
    }

    input.advance();
  }
});
