/** Dev helper: print per-token scopes for ad-hoc .nota lines, to author precise
 *  tmgrammar-test assertions. Not part of the test suite. Usage:
 *    node --import tsx tests/_scope_dump.ts '@Aside[x: 1]{hi}'
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
const NOTA = join(pkgRoot, "syntaxes", "nota.tmLanguage.json");
const TS = join(
  pkgRoot,
  "node_modules",
  "tm-grammars",
  "grammars",
  "typescript.json"
);

const wasmBin = readFileSync(
  require.resolve("vscode-oniguruma/release/onig.wasm")
).buffer;
const onigLib = oniguruma.loadWASM(wasmBin).then(() => ({
  createOnigScanner: (p: string[]) => new oniguruma.OnigScanner(p),
  createOnigString: (s: string) => new oniguruma.OnigString(s)
}));
const paths: Record<string, string> = { "source.nota": NOTA, "source.ts": TS };
const registry = new vsctm.Registry({
  onigLib,
  loadGrammar: async (scope: string) => {
    const p = paths[scope];
    return p ? vsctm.parseRawGrammar(readFileSync(p, "utf8"), p) : null;
  }
});

async function main() {
  const text = process.argv.slice(2).join(" ") || "@p{Hello @em{world}}";
  const grammar = await registry.loadGrammar("source.nota");
  if (!grammar) throw new Error("no grammar");
  let stack = vsctm.INITIAL;
  for (const line of text.split("\\n")) {
    const r = grammar.tokenizeLine(line, stack);
    stack = r.ruleStack;
    console.log(`LINE: ${JSON.stringify(line)}`);
    for (const t of r.tokens) {
      const frag = line.substring(t.startIndex, t.endIndex);
      console.log(
        `  [${t.startIndex}-${t.endIndex}) ${JSON.stringify(frag).padEnd(16)} ${t.scopes.join("  ")}`
      );
    }
  }
}
main();
