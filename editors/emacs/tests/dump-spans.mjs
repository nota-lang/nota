/**
 * Dump the reader's highlight spans for every `integration/*.nota` as JSON — the ground truth
 * the emacs conformance test (conformance.el) checks the font-lock tier against.
 *
 * Usage: node dump-spans.mjs <out.json>   (run from anywhere; paths resolve from this file)
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const INTEGRATION = join(REPO, "integration");

const { highlightSpans } = await import(
  join(REPO, "packages", "compiler", "dist", "lib.js")
);

const out = {};
for (const name of readdirSync(INTEGRATION).filter(f => f.endsWith(".nota"))) {
  const source = readFileSync(join(INTEGRATION, name), "utf8");
  out[name] = highlightSpans(source).map(s => ({
    start: s.start,
    end: s.end,
    kind: s.kind
  }));
}

writeFileSync(process.argv[2], JSON.stringify(out));
