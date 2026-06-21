/**
 * The vitest entry point for the Nota TextMate grammar — this is what `depot test` runs.
 *
 * Three layers, cheapest first:
 *   1. **Structure** — the grammar JSON declares every load-bearing repository key + scope.
 *   2. **Real-engine tokenization** — vscode-textmate + Oniguruma tokenize a representative sample
 *      without rejecting a regex, and the load-bearing scopes actually land on tokens. (This is the
 *      same ground the headless `tokenize.smoke.ts` fallback covers, sharing `_engine.ts`.)
 *   3. **Caret assertions** — the `vscode-tmgrammar-test` CLI over the `*.test.nota` fixtures (the
 *      precise, column-aligned assertions). Spawned as a subprocess gate; its output is surfaced on
 *      failure. This is the PRIMARY grammar test — vitest just drives it so `depot test` covers it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import {
  collectScopes,
  EXPECTED_TOKEN_SCOPES,
  hasScope,
  loadNotaGrammar,
  NOTA_GRAMMAR_PATH,
  PKG_ROOT,
  REQUIRED_GRAMMAR_SCOPES,
  REQUIRED_REPO_KEYS,
  SAMPLE,
  type TokenizeResult,
  TS_GRAMMAR_PATH
} from "./_engine";

describe("nota.tmLanguage — structure", () => {
  const raw = JSON.parse(readFileSync(NOTA_GRAMMAR_PATH, "utf8")) as {
    scopeName?: string;
    repository?: Record<string, unknown>;
  };
  const grammarText = JSON.stringify(raw);

  it("declares scopeName source.nota", () => {
    expect(raw.scopeName).toBe("source.nota");
  });

  it.each(REQUIRED_REPO_KEYS)("repository defines #%s", key => {
    expect(raw.repository ?? {}).toHaveProperty(key);
  });

  it.each(REQUIRED_GRAMMAR_SCOPES)("assigns scope %s somewhere", scope => {
    expect(grammarText).toContain(scope);
  });
});

describe("real-engine tokenization (vscode-textmate + oniguruma)", () => {
  let tok: TokenizeResult;
  beforeAll(async () => {
    tok = collectScopes(await loadNotaGrammar(), SAMPLE);
  });

  it("tokenizes the sample without an Oniguruma regex rejection", () => {
    expect(tok.totalTokens).toBeGreaterThan(0);
  });

  it.each(EXPECTED_TOKEN_SCOPES)("emits scope %s on some token", scope => {
    expect(hasScope(tok.seenScopes, scope)).toBe(true);
  });
});

describe("vscode-tmgrammar-test — .test.nota caret assertions", () => {
  it("all assertion fixtures pass", () => {
    const require = createRequire(import.meta.url);
    const cli = require.resolve("vscode-tmgrammar-test/dist/unit.js");
    try {
      execFileSync(
        process.execPath,
        [
          cli,
          "-g",
          TS_GRAMMAR_PATH,
          "-g",
          NOTA_GRAMMAR_PATH,
          "tests/**/*.test.nota"
        ],
        { cwd: PKG_ROOT, encoding: "utf8", stdio: "pipe" }
      );
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string };
      const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
      throw new Error(`vscode-tmgrammar-test reported failures:\n${out}`);
    }
  });
});
