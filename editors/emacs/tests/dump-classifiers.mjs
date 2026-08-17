/**
 * Dump the reader's highlight-kind vocabulary and a table of fence-delimiter edge-case verdicts
 * as JSON -- ground truth for tests/conformance.el's vocabulary check (every kind name in
 * `nota-conf--face-kinds' must be real) and fence-agreement cases (the shared elisp fence
 * defconsts in `nota-mode.el' "Fence grammar" vs the reader).
 *
 * %%%-family cases are checked against the reader's own exported `lineClassifiers()' regexes
 * (JS-compatible `regex`-crate sources -- see `NotaLineClassifiers' in the generated bindings).
 * The backtick family has no reader-exported line classifier (only %%% does), so its cases are
 * checked by actually parsing a small synthetic document through `highlightSpans()' and looking
 * for a `code-delim' span over the candidate's delimiter run -- robust by construction (it calls
 * the real reader) rather than hand-transliterating `scan_fenced_code'/`find_backtick_close' a
 * third time, which is exactly the drift this harness exists to catch.
 *
 * Usage: node dump-classifiers.mjs <cases.json> <out.json>   (run from anywhere; paths resolve
 * from this file)
 *   cases.json: [{"name", "family": "percent"|"backtick", "role": "open"|"close", "line"}, ...]
 *   out.json:   {"kindNames": [...], "cases": [{...same fields..., "readerVerdict": bool}]}
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");

const { highlightKindNames, highlightSpans } = await import(
  join(REPO, "packages", "compiler", "dist", "lib.js")
);
const { lineClassifiers } = await import(
  join(REPO, "packages", "compiler", "dist", "reader.js")
);

const classifiers = lineClassifiers();
const FENCE_LINE = new RegExp(classifiers.fenceLine);
const FENCE_CLOSE_LINE = new RegExp(classifiers.fenceCloseLine);

// Does a `code-delim` span cover `pos` in `source`? The fence delimiter's own run (open or
// close) is the one construct emitting that kind (highlight.rs `visit_nota_code`), so this is a
// direct "did the reader recognize a fence boundary here" probe.
function codeDelimAt(source, pos) {
  return highlightSpans(source).some(
    s => s.kind === "code-delim" && s.start <= pos && pos < s.end
  );
}

function backtickVerdict(role, line) {
  // OPEN: `line` is the fence's opening line, followed by a plain body and a known-good close
  // (a fence needs a following line to be a fence at all, not inline code). CLOSE: a known-good
  // open, a plain body, then `line` as the candidate closer.
  const prefix = role === "open" ? "" : "```\nbody\n";
  const suffix = role === "open" ? "\nbody\n```\nafter\n" : "\nafter\n";
  const source = prefix + line + suffix;
  const runStart = source.indexOf("`", prefix.length);
  return codeDelimAt(source, runStart);
}

function percentVerdict(role, line) {
  return (role === "open" ? FENCE_LINE : FENCE_CLOSE_LINE).test(line);
}

const cases = JSON.parse(readFileSync(process.argv[2], "utf8"));
const verdicts = cases.map(c => ({
  ...c,
  readerVerdict:
    c.family === "percent"
      ? percentVerdict(c.role, c.line)
      : backtickVerdict(c.role, c.line)
}));

writeFileSync(
  process.argv[3],
  JSON.stringify({ kindNames: highlightKindNames(), cases: verdicts })
);
