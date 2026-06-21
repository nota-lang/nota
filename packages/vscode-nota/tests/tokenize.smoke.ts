/**
 * Fallback / sanity tokenizer test (impl.md §5.8 layer 4 fallback).
 *
 * Loads the Nota grammar with the REAL vscode-textmate + vscode-oniguruma
 * engine (the same engine VSCode runs), registers `source.ts` from tm-grammars
 * so embedded regions resolve, and:
 *   1. asserts the grammar is valid JSON containing the required patterns/scopes;
 *   2. tokenizes a representative `.nota` sample without the Oniguruma engine
 *      rejecting any regex (this catches \p{L} / backreference issues that plain
 *      JSON validation misses);
 *   3. spot-checks that a few load-bearing scopes show up on the right tokens.
 *
 * This runs headless under plain Node, so it works even where the full
 * vscode-tmgrammar-test harness cannot. The PRIMARY tests are the
 * vscode-tmgrammar-test `.nota` assertion files (run via `pnpm test`); this is
 * the belt-and-suspenders fallback.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as oniguruma from "vscode-oniguruma";
import * as vsctm from "vscode-textmate";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");

const NOTA_GRAMMAR_PATH = join(pkgRoot, "syntaxes", "nota.tmLanguage.json");
const TS_GRAMMAR_PATH = join(pkgRoot, "node_modules", "tm-grammars", "grammars", "typescript.json");

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    console.log(`  ok  - ${label}`);
  } else {
    console.error(`  FAIL- ${label}`);
    failures++;
  }
}

// ---- 1. Structural assertions on the grammar JSON ------------------------------
const notaRaw = JSON.parse(readFileSync(NOTA_GRAMMAR_PATH, "utf8"));
check("grammar scopeName is source.nota", notaRaw.scopeName === "source.nota");
const repo = notaRaw.repository ?? {};
const requiredRepoKeys = [
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
for (const k of requiredRepoKeys) {
  check(`repository has #${k}`, k in repo);
}
// the embedded-TS contract: props / paren-expr / statements must include source.ts
const grammarText = JSON.stringify(notaRaw);
check("grammar embeds source.ts somewhere", grammarText.includes("source.ts"));
check("grammar assigns entity.name.tag (host)", grammarText.includes("entity.name.tag.html.nota"));
check(
  "grammar assigns support.class.component",
  grammarText.includes("support.class.component.nota")
);
check("grammar assigns markup.bold", grammarText.includes("markup.bold.nota"));
check("grammar assigns markup.italic", grammarText.includes("markup.italic.nota"));
check("grammar assigns markup.heading", grammarText.includes("markup.heading.nota"));
check(
  "grammar assigns constant.character.escape",
  grammarText.includes("constant.character.escape.nota")
);

// ---- 2. Real-engine load + tokenize -------------------------------------------
const wasmBin = readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm")).buffer;
const vscodeOnigurumaLib = oniguruma.loadWASM(wasmBin).then(() => ({
  createOnigScanner: (patterns: string[]) => new oniguruma.OnigScanner(patterns),
  createOnigString: (s: string) => new oniguruma.OnigString(s)
}));

const grammarPaths: Record<string, string> = {
  "source.nota": NOTA_GRAMMAR_PATH,
  "source.ts": TS_GRAMMAR_PATH
};

const registry = new vsctm.Registry({
  onigLib: vscodeOnigurumaLib,
  loadGrammar: async (scopeName: string) => {
    const p = grammarPaths[scopeName];
    if (!p) {
      // Unknown embedded scope (e.g. a code-fence language we did not provide):
      // returning null is what VSCode does; the region just stays unscoped.
      return null;
    }
    return vsctm.parseRawGrammar(readFileSync(p, "utf8"), p);
  }
});

const SAMPLE = String.raw`# Heading with *bold* and _em_

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

Inline ` + "`@x`" + String.raw` code, then math $a_@i$ and display:

$$
\sum_@n x
$$

` + "```typescript\nconst f = (x: number) => x + 1;\n```" + String.raw`

An escape: \@ \{ \} \| \$ \* \_ \: \[ \] and a backslash \\.
Intra-word stays literal: my_var_name and 50% off.
`;

async function main(): Promise<void> {
  console.log("# tokenize.smoke");
  const grammar = await registry.loadGrammar("source.nota");
  if (!grammar) {
    console.error("  FAIL- could not load source.nota grammar");
    process.exit(1);
  }

  // Tokenize line-by-line; any Oniguruma regex rejection throws here.
  const lines = SAMPLE.split("\n");
  let ruleStack = vsctm.INITIAL;
  let totalTokens = 0;
  const seenScopes = new Set<string>();
  for (const line of lines) {
    const r = grammar.tokenizeLine(line, ruleStack);
    ruleStack = r.ruleStack;
    totalTokens += r.tokens.length;
    for (const t of r.tokens) {
      for (const s of t.scopes) seenScopes.add(s);
    }
  }
  check("tokenized sample without engine error", totalTokens > 0);

  // 3. Spot-check load-bearing scopes appear at least once across the sample.
  const expectScopes = [
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
  for (const s of expectScopes) {
    check(`saw scope ${s}`, [...seenScopes].some(x => x === s || x.startsWith(`${s} `) || x.includes(s)));
  }

  console.log(`\n# tokenized ${totalTokens} tokens across ${lines.length} lines`);
  if (failures > 0) {
    console.error(`\nNOT OK - ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nOK - all smoke checks passed");
}

main().catch(err => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
