/**
 * Headless fallback / sanity tokenizer test.
 *
 * Loads the Nota grammar with the REAL vscode-textmate + vscode-oniguruma engine (via the shared
 * `_engine.ts`) and:
 *   1. asserts the grammar JSON declares the required repository keys + scopes;
 *   2. tokenizes a representative `.nota` sample without Oniguruma rejecting any regex (this catches
 *      \p{L} / backreference issues that plain JSON validation misses);
 *   3. spot-checks that the load-bearing scopes show up on the right tokens.
 *
 * This runs headless under plain Node (`node --import tsx tests/tokenize.smoke.ts`), so it works even
 * where vitest / the vscode-tmgrammar-test harness cannot. The PRIMARY tests are the vitest runner
 * (`grammar.test.ts`, which `depot test` runs) and the `.test.nota` assertion fixtures; this is the
 * belt-and-suspenders fallback, sharing fixtures with the runner so the two cannot diverge.
 */
import { readFileSync } from "node:fs";
import {
  collectScopes,
  EXPECTED_TOKEN_SCOPES,
  hasScope,
  loadNotaGrammar,
  NOTA_GRAMMAR_PATH,
  REQUIRED_GRAMMAR_SCOPES,
  REQUIRED_REPO_KEYS,
  SAMPLE
} from "./_engine";

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
for (const k of REQUIRED_REPO_KEYS) {
  check(`repository has #${k}`, k in repo);
}
const grammarText = JSON.stringify(notaRaw);
for (const s of REQUIRED_GRAMMAR_SCOPES) {
  check(`grammar assigns ${s}`, grammarText.includes(s));
}

// ---- 2. Real-engine load + tokenize -------------------------------------------
async function main(): Promise<void> {
  console.log("# tokenize.smoke");
  const grammar = await loadNotaGrammar();
  const { totalTokens, seenScopes } = collectScopes(grammar, SAMPLE);
  check("tokenized sample without engine error", totalTokens > 0);

  // 3. Spot-check load-bearing scopes appear at least once across the sample.
  for (const s of EXPECTED_TOKEN_SCOPES) {
    check(`saw scope ${s}`, hasScope(seenScopes, s));
  }

  const lineCount = SAMPLE.split("\n").length;
  console.log(`\n# tokenized ${totalTokens} tokens across ${lineCount} lines`);
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
