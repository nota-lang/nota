/** Dev helper: given a .nota source file, emit a vscode-tmgrammar-test unit file
 *  with one correctly-aligned `^` assertion per token, asserting that token's
 *  deepest (last) scope. Used to AUTHOR the .test.nota fixtures with exact caret
 *  alignment, then hand-trim to the load-bearing assertions. Not run in CI.
 *
 *  Usage: node --import tsx tests/_gen_assertions.ts path/to/source.nota
 *  The column convention used by vscode-tmgrammar-test: a `^` at column C on a
 *  `// ...` line asserts the source token at column C-? -- so rather than reason
 *  about the offset, we place the caret at the SAME column index as the token's
 *  startIndex, prefixed by enough characters of the comment token. Empirically
 *  the tool aligns `^` at print-column == source startIndex when the assertion
 *  line begins with the comment token immediately followed by spaces then `^`.
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
  const srcPath = process.argv[2];
  const src = readFileSync(srcPath, "utf8").replace(/\n$/, "");
  const grammar = await registry.loadGrammar("source.nota");
  if (!grammar) throw new Error("no grammar");
  let stack = vsctm.INITIAL;
  const out: string[] = [];
  for (const line of src.split("\n")) {
    out.push(line);
    const r = grammar.tokenizeLine(line, stack);
    stack = r.ruleStack;
    for (const t of r.tokens) {
      const frag = line.substring(t.startIndex, t.endIndex);
      if (frag.trim() === "") continue;
      const deepest = t.scopes[t.scopes.length - 1];
      // The `^` at assertion-line column C asserts source column C (no offset).
      // The "//" prefix occupies columns 0-1, so we need (startIndex-2) spaces
      // before the caret. Tokens at column 0/1 must use `<-` instead; skip them.
      if (t.startIndex < 2) {
        out.push(
          `// (token at col ${t.startIndex} needs <- ; scope ${deepest})`
        );
        continue;
      }
      const pad = " ".repeat(t.startIndex - 2);
      const carets = "^".repeat(Math.max(1, t.endIndex - t.startIndex));
      out.push(`//${pad}${carets} ${deepest}`);
    }
  }
  console.log(out.join("\n"));
}
main();
