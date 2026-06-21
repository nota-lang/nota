/**
 * Shared TextMate engine + fixtures for the Nota grammar tests.
 *
 * Loads the Nota grammar with the REAL vscode-textmate + vscode-oniguruma engine (the same engine
 * VSCode runs), registering `source.ts` from tm-grammars so embedded regions resolve. Both the
 * vitest runner (`grammar.test.ts`) and the headless fallback script (`tokenize.smoke.ts`) consume
 * this module, so the sample document and the load-bearing scope expectations live in exactly one
 * place. The `_` prefix keeps this file out of vitest's `*.test.ts` glob — it is a helper, not a
 * suite.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as oniguruma from "vscode-oniguruma";
import * as vsctm from "vscode-textmate";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/** The package root (`tests/` lives directly under it). */
export const PKG_ROOT = join(here, "..");
/** The Nota grammar under test. */
export const NOTA_GRAMMAR_PATH = join(
  PKG_ROOT,
  "syntaxes",
  "nota.tmLanguage.json"
);
/** The bundled TypeScript grammar, registered so embedded `source.ts` regions resolve. */
export const TS_GRAMMAR_PATH = join(
  PKG_ROOT,
  "node_modules",
  "tm-grammars",
  "grammars",
  "typescript.json"
);

/**
 * Build the registry and load `source.nota` with the real Oniguruma engine. Throws if the grammar
 * fails to load (a missing scope, an invalid regex Oniguruma rejects, etc.). The WASM load is done
 * lazily here so merely importing this module is cheap.
 */
export async function loadNotaGrammar(): Promise<vsctm.IGrammar> {
  const wasmBin = readFileSync(
    require.resolve("vscode-oniguruma/release/onig.wasm")
  ).buffer;
  const onigLib = oniguruma.loadWASM(wasmBin).then(() => ({
    createOnigScanner: (patterns: string[]) =>
      new oniguruma.OnigScanner(patterns),
    createOnigString: (s: string) => new oniguruma.OnigString(s)
  }));
  const grammarPaths: Record<string, string> = {
    "source.nota": NOTA_GRAMMAR_PATH,
    "source.ts": TS_GRAMMAR_PATH
  };
  const registry = new vsctm.Registry({
    onigLib,
    loadGrammar: async (scopeName: string) => {
      const p = grammarPaths[scopeName];
      // Unknown embedded scope (e.g. a code-fence language we did not provide): returning null is
      // what VSCode does; the region just stays unscoped.
      return p ? vsctm.parseRawGrammar(readFileSync(p, "utf8"), p) : null;
    }
  });
  const grammar = await registry.loadGrammar("source.nota");
  if (!grammar) {
    throw new Error("could not load source.nota grammar");
  }
  return grammar;
}

/** The result of {@link collectScopes}: total tokens emitted and the set of every scope seen. */
export interface TokenizeResult {
  totalTokens: number;
  seenScopes: Set<string>;
}

/**
 * Tokenize `source` line-by-line, threading the rule stack. Any Oniguruma regex rejection throws
 * here (which is the point — plain JSON validation misses `\p{L}` / backreference issues).
 */
export function collectScopes(
  grammar: vsctm.IGrammar,
  source: string
): TokenizeResult {
  const seenScopes = new Set<string>();
  let ruleStack = vsctm.INITIAL;
  let totalTokens = 0;
  for (const line of source.split("\n")) {
    const r = grammar.tokenizeLine(line, ruleStack);
    ruleStack = r.ruleStack;
    totalTokens += r.tokens.length;
    for (const t of r.tokens) {
      for (const s of t.scopes) {
        seenScopes.add(s);
      }
    }
  }
  return { totalTokens, seenScopes };
}

/** True if `scope` appears in `seen`, allowing a dotted-suffix or substring match. */
export function hasScope(seen: Set<string>, scope: string): boolean {
  return [...seen].some(
    x => x === scope || x.startsWith(`${scope} `) || x.includes(scope)
  );
}

/** Repository keys the grammar must define (one per load-bearing construct). */
export const REQUIRED_REPO_KEYS = [
  "markup",
  "escape",
  "element",
  "interpolation",
  "props",
  "body",
  "bold",
  "italic",
  "heading",
  "list",
  "control-flow",
  "line-statement",
  "fence-statement",
  "verbatim",
  "code-block",
  "code-inline",
  "math-display",
  "math-inline"
];

/** Scope strings that must appear *somewhere* in the grammar JSON (the embedded-TS + markup contract). */
export const REQUIRED_GRAMMAR_SCOPES = [
  "source.ts",
  "entity.name.tag.html.nota",
  "support.class.component.nota",
  "markup.bold.nota",
  "markup.italic.nota",
  "markup.heading.nota",
  "constant.character.escape.nota"
];

/** Load-bearing scopes that must land on at least one token when {@link SAMPLE} is tokenized. */
export const EXPECTED_TOKEN_SCOPES = [
  "entity.name.tag.html.nota",
  "support.class.component.nota",
  "entity.name.tag.dynamic.nota",
  "variable.other.interpolation.nota",
  "markup.bold.nota",
  "markup.italic.nota",
  "markup.heading.nota",
  "keyword.control.nota",
  "keyword.control.conditional.nota",
  "constant.character.escape.nota",
  "markup.raw.verbatim.nota",
  "markup.raw.code.inline.nota",
  "markup.math.inline.nota",
  "markup.math.display.nota",
  "punctuation.definition.list.begin.nota",
  "source.ts"
];

/**
 * A representative `.nota` document exercising every load-bearing construct: headings, emphasis,
 * host/component/dynamic elements, props, interpolation, control flow, line + fence statements,
 * verbatim, inline/display math, a fenced code block, and escapes. Assembled by concatenation so the
 * backtick- and `$`-bearing fragments survive as literals.
 */
export const SAMPLE =
  `# Heading with *bold* and _em_

@p{Hello @em{world} and @name here.}

@Aside[variant: "tip", count: n + 1]{
  Body with @(user.posts[0]) interpolation.
}

@(getTag()){dynamic}

@if (count > 0) {
  @p{Positive}
} else if (count < 0) {
  @p{Negative}
} else {
  @p{Zero}
}

@for (x of items) {
  - @li{@x}
}

% const total = items.length

%%%
const xs = await load();
const n = xs.reduce((a, b) => a + b, 0);
%%%

@code|{ @foo{x} is literal here }|

Inline ` +
  "`@x`" +
  String.raw` code, then math $a_@i$ and display:

$$
\sum_@n x
$$

` +
  "```typescript\nconst f = (x: number) => x + 1;\n```" +
  String.raw`

An escape: \@ \{ \} \| \$ \* \_ \: \[ \] and a backslash \\.
Intra-word stays literal: my_var_name and 50% off.
`;
