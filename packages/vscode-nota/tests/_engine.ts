/**
 * Shared TextMate engine + paths for the Nota grammar tests.
 *
 * Loads the Nota grammar with the REAL vscode-textmate + vscode-oniguruma engine (the same engine
 * VSCode runs), registering `source.ts` from tm-grammars so embedded regions resolve. The node-run
 * conformance suite (`conformance.ts`) consumes this module; the precise column-aligned assertions
 * live in the `*.test.nota` fixtures (run by the `vscode-tmgrammar-test` CLI). The `_` prefix keeps
 * this file out of any `*.test.*` glob — it is a helper, not a suite.
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
/** The repo's shared `integration/*.nota` fixtures (the conformance corpus). */
export const INTEGRATION_DIR = join(PKG_ROOT, "..", "..", "integration");

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

/** One tokenized span: its line-local UTF-16 range and the full scope stack (outer -> inner). */
export interface Token {
  line: number;
  startIndex: number;
  endIndex: number;
  scopes: string[];
}

/** Tokenize a whole `source`, threading the rule stack; returns a flat token list. */
export function tokenizeAll(grammar: vsctm.IGrammar, source: string): Token[] {
  const out: Token[] = [];
  let ruleStack = vsctm.INITIAL;
  const lines = source.split("\n");
  for (let line = 0; line < lines.length; line++) {
    const r = grammar.tokenizeLine(lines[line], ruleStack);
    ruleStack = r.ruleStack;
    for (const t of r.tokens) {
      out.push({
        line,
        startIndex: t.startIndex,
        endIndex: t.endIndex,
        scopes: t.scopes
      });
    }
  }
  return out;
}

/** The full set of scopes seen when tokenizing `source` (for smoke assertions). */
export function collectScopes(
  grammar: vsctm.IGrammar,
  source: string
): { totalTokens: number; seenScopes: Set<string> } {
  const seenScopes = new Set<string>();
  let totalTokens = 0;
  for (const t of tokenizeAll(grammar, source)) {
    totalTokens++;
    for (const s of t.scopes) {
      seenScopes.add(s);
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
