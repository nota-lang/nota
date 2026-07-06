/**
 * The Nota grammar's node-run test entry (`pnpm run test:conformance`) — three layers:
 *
 *   1. STRUCTURE — the grammar JSON declares every load-bearing repository key + Nota scope.
 *   2. SMOKE — vscode-textmate + Oniguruma tokenize a representative sample without rejecting a
 *      regex (this catches `\p{L}` / backreference issues that plain JSON validation misses) and the
 *      load-bearing scopes actually land on tokens.
 *   3. D1 SUBSET-CORRECTNESS CONFORMANCE — the heart of the "never lie" contract. We run the compiled
 *      grammar (the SAME vscode-textmate + Oniguruma engine VSCode uses) over every shared
 *      `integration/*.nota` fixture (`mega.nota` mandatory) and, for every token the grammar claims
 *      with a Nota-specific scope, assert the claim AGREES with the reader's `highlightSpans` kind at
 *      that offset — via a scope -> allowed-reader-kind-set table. Underpainting (no Nota claim, or a
 *      claim delegated to embedded `source.ts`) always passes; a WRONG claim (a byte the grammar
 *      paints with a Nota scope whose reader kind is not in the allowed set) fails. This is the drift
 *      guard: it is not a generator, it just proves the grammar never over-claims relative to the
 *      reader — the faithful layer the LSP semantic tokens serve.
 *
 * Runs headless under plain Node (`node --import tsx tests/conformance.ts`); no vitest, no VSCode.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightKindNames, highlightSpans } from "@nota-lang/compiler";
import {
  collectScopes,
  hasScope,
  INTEGRATION_DIR,
  loadNotaGrammar,
  NOTA_GRAMMAR_PATH,
  tokenizeAll
} from "./_engine";

let failures = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`  ok   - ${label}`);
  } else {
    console.error(`  FAIL - ${label}${detail ? `\n${detail}` : ""}`);
    failures++;
  }
}

// ===================================================================================================
// The scope -> allowed-reader-kind-set table. This is the contract: a grammar token whose deepest
// Nota claim-scope is KEY is honest at a byte iff the reader's highlight kinds covering that byte
// intersect VALUE. Every claim-scope the grammar can emit MUST appear here (an unmapped scope fails
// the conformance run, so the table cannot silently drift behind the grammar).
// ===================================================================================================
const SCOPE_KINDS: Record<string, string[]> = {
  // escapes
  "constant.character.escape.nota": ["escape"],
  // % / %%% statement sigils (interiors are embedded source.ts -> delegated, not checked)
  "punctuation.definition.statement.begin.nota": ["sigil"],
  "punctuation.definition.statement.end.nota": ["sigil"],
  "punctuation.definition.statement.nota": ["sigil"],
  // headings
  "markup.heading.nota": ["heading"],
  "punctuation.definition.heading.nota": ["heading-marker", "heading"],
  // list markers
  "punctuation.definition.list.begin.nota": ["list-marker"],
  // block-sugar prop-line marker
  "punctuation.definition.propline.nota": ["sigil"],
  // code (fenced + inline)
  "punctuation.definition.raw.code.begin.nota": ["code-delim"],
  "punctuation.definition.raw.code.end.nota": ["code-delim"],
  "entity.name.tag.lang.nota": ["code-lang"],
  "markup.raw.code.block.nota": ["code"],
  "markup.inline.raw.code.nota": ["code"],
  // math (fenced + inline)
  "punctuation.definition.math.begin.nota": ["math-delim"],
  "punctuation.definition.math.end.nota": ["math-delim"],
  "markup.math.nota": ["math"],
  // verbatim delimiters (interior deliberately unpainted)
  "punctuation.definition.verbatim.begin.nota": ["sigil"],
  "punctuation.definition.verbatim.end.nota": ["sigil"],
  // @-form heads
  "punctuation.definition.tag.nota": ["sigil"],
  "entity.name.tag.html.nota": ["tag-host"],
  "support.class.component.nota": ["tag-component"],
  "keyword.operator.colon-sugar.nota": ["sigil"],
  "punctuation.definition.keyword.nota": ["sigil"],
  "keyword.control.nota": ["control-keyword"],
  "punctuation.definition.interpolation.nota": ["sigil"],
  "variable.other.interpolation.nota": ["interpolation"],
  // emphasis (the reader marks the delimiter byte as BOTH sigil and the emphasis under-layer)
  "punctuation.definition.bold.nota": ["sigil", "emphasis-strong"],
  "markup.bold.nota": ["emphasis-strong"],
  "punctuation.definition.italic.nota": ["sigil", "emphasis-em"],
  "markup.italic.nota": ["emphasis-em"]
};

/** Embedded-language root scopes: any token carrying one is delegated (not a Nota claim). */
const DELEGATED_ROOTS = new Set([
  "source.ts",
  "source.tsx",
  "source.js",
  "source.jsx",
  "source.json",
  "source.css"
]);

/** The deepest Nota claim-scope on a token, or null if the token makes no glyph-level Nota claim. */
function claimScope(scopes: string[]): string | null {
  if (scopes.some(s => DELEGATED_ROOTS.has(s))) {
    return null;
  }
  let claim: string | null = null;
  for (const s of scopes) {
    if (
      s.endsWith(".nota") &&
      !s.startsWith("meta.") &&
      !s.startsWith("source.")
    ) {
      claim = s;
    }
  }
  return claim;
}

// ===================================================================================================
// 1. Structural assertions.
// ===================================================================================================
const REQUIRED_REPO_KEYS = [
  "main",
  "inline",
  "escape",
  "statement-fence",
  "statement-line",
  "heading",
  "list",
  "prop-line",
  "code-fence",
  "math-fence",
  "verbatim-fence",
  "verbatim-inline",
  "code-inline",
  "math-display-inline",
  "math-inline",
  "control",
  "colon-element",
  "element",
  "at-sigil",
  "interpolation",
  "emphasis-strong",
  "emphasis-em"
];

/** Every scope the table maps must be assigned SOMEWHERE in the grammar (and vice-versa is covered
 * by the conformance run flagging unmapped scopes). */
const raw = JSON.parse(readFileSync(NOTA_GRAMMAR_PATH, "utf8")) as {
  scopeName?: string;
  repository?: Record<string, unknown>;
};
const grammarText = JSON.stringify(raw);
check("grammar scopeName is source.nota", raw.scopeName === "source.nota");
for (const k of REQUIRED_REPO_KEYS) {
  check(`repository defines #${k}`, k in (raw.repository ?? {}));
}
for (const s of Object.keys(SCOPE_KINDS)) {
  check(`grammar assigns ${s}`, grammarText.includes(s));
}

// ===================================================================================================
// 2. Smoke: real-engine tokenization of a representative sample.
// ===================================================================================================
const SAMPLE = `# Heading with *bold* and _em_

@Aside[variant: "tip", count: n + 1]{
  Body with @name and @(user.posts[0]) and a set {1, 2}.
}

@summary: A colon-sugar element.

@if (count > 0) {@p{Positive}}

% const total = items.length

%%%
const xs = await load();
%%%

@code|{ @foo{x} is literal }|

Inline ${"`"}f(x)${"`"} code, math $a_@i$, and a list:

- first *item*
- second

An escape: \\@ \\* and 2*3*4 my_var stay literal.
`;

const EXPECTED_TOKEN_SCOPES = [
  "entity.name.tag.html.nota",
  "support.class.component.nota",
  "variable.other.interpolation.nota",
  "keyword.control.nota",
  "keyword.operator.colon-sugar.nota",
  "markup.heading.nota",
  "markup.bold.nota",
  "markup.italic.nota",
  "constant.character.escape.nota",
  "punctuation.definition.list.begin.nota",
  "punctuation.definition.raw.code.begin.nota",
  "punctuation.definition.math.begin.nota",
  "punctuation.definition.verbatim.begin.nota",
  "punctuation.definition.statement.nota",
  "source.ts"
];

// ===================================================================================================
// 3. D1 subset-correctness conformance over the integration fixtures.
// ===================================================================================================

interface Violation {
  fixture: string;
  line: number;
  col: number;
  text: string;
  scope: string;
  allowed: string[];
  readerKinds: string[];
}

interface FixtureResult {
  fixture: string;
  claims: number;
  checkedBytes: number;
  unmapped: Set<string>;
  violations: Violation[];
}

async function conformFixture(
  grammar: Awaited<ReturnType<typeof loadNotaGrammar>>,
  fixture: string,
  source: string
): Promise<FixtureResult> {
  const buf = Buffer.from(source, "utf8");
  // Per-byte reader-kind coverage (a byte may be covered by several overlapping spans).
  const byteKinds: Array<Set<string>> = Array.from(
    { length: buf.length },
    () => new Set<string>()
  );
  for (const span of highlightSpans(source)) {
    for (let b = span.start; b < span.end && b < buf.length; b++) {
      byteKinds[b].add(span.kind);
    }
  }

  // Byte offset of the start of each line (fixtures use `\n`).
  const lines = source.split("\n");
  const lineByteStart: number[] = new Array(lines.length);
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    lineByteStart[i] = acc;
    acc += Buffer.byteLength(lines[i], "utf8") + 1; // + `\n`
  }

  const result: FixtureResult = {
    fixture,
    claims: 0,
    checkedBytes: 0,
    unmapped: new Set(),
    violations: []
  };

  for (const t of tokenizeAll(grammar, source)) {
    const claim = claimScope(t.scopes);
    if (claim === null) {
      continue;
    }
    const allowed = SCOPE_KINDS[claim];
    if (!allowed) {
      result.unmapped.add(claim);
      continue;
    }
    result.claims++;
    const lineText = lines[t.line];
    const base = lineByteStart[t.line];
    const startByte =
      base + Buffer.byteLength(lineText.slice(0, t.startIndex), "utf8");
    const endByte =
      base + Buffer.byteLength(lineText.slice(0, t.endIndex), "utf8");
    for (let b = startByte; b < endByte && b < buf.length; b++) {
      const c = buf[b];
      if (c === 0x20 || c === 0x09 || c === 0x0d) {
        continue; // whitespace carries no visible claim
      }
      result.checkedBytes++;
      const kinds = byteKinds[b];
      let ok = false;
      for (const a of allowed) {
        if (kinds.has(a)) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        result.violations.push({
          fixture,
          line: t.line + 1,
          col: t.startIndex,
          text: lineText.slice(t.startIndex, t.endIndex),
          scope: claim,
          allowed,
          readerKinds: [...kinds]
        });
        break; // one violation per token is enough
      }
    }
  }
  return result;
}

async function main(): Promise<void> {
  console.log("# nota grammar — structure + smoke + D1 conformance\n");
  const grammar = await loadNotaGrammar();

  // Smoke.
  const { totalTokens, seenScopes } = collectScopes(grammar, SAMPLE);
  check("tokenized sample without an Oniguruma rejection", totalTokens > 0);
  for (const s of EXPECTED_TOKEN_SCOPES) {
    check(`smoke sample emits ${s}`, hasScope(seenScopes, s));
  }

  // Conformance.
  console.log(
    `\n# D1 subset-correctness over integration/*.nota (reader kinds: ${highlightKindNames().length})`
  );
  const fixtures = readdirSync(INTEGRATION_DIR)
    .filter(f => f.endsWith(".nota"))
    .sort();
  check("mega.nota is present in the corpus", fixtures.includes("mega.nota"));

  let totalClaims = 0;
  for (const f of fixtures) {
    const source = readFileSync(join(INTEGRATION_DIR, f), "utf8");
    let res: FixtureResult;
    try {
      res = await conformFixture(grammar, f, source);
    } catch (err) {
      check(
        `${f} — reader parsed for conformance`,
        false,
        `    ${(err as Error).message}`
      );
      continue;
    }
    totalClaims += res.claims;
    const unmapped = [...res.unmapped];
    check(
      `${f} — all ${res.claims} Nota claims agree with the reader ` +
        `(${res.checkedBytes} bytes checked)`,
      res.violations.length === 0 && unmapped.length === 0,
      [
        ...res.violations.map(
          v =>
            `    line ${v.line} col ${v.col} ${JSON.stringify(v.text)} ` +
            `claims <${v.scope}> (allows ${v.allowed.join("|")}) but reader has ` +
            `[${v.readerKinds.join(",") || "<nothing>"}]`
        ),
        ...unmapped.map(
          u => `    unmapped claim-scope <${u}> — add it to SCOPE_KINDS`
        )
      ].join("\n")
    );
  }
  check("grammar makes at least one claim across the corpus", totalClaims > 0);

  console.log(
    `\n# ${fixtures.length} fixtures, ${totalClaims} Nota claims checked, ${totalTokens} smoke tokens`
  );
  if (failures > 0) {
    console.error(`\nNOT OK — ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log(
    "\nOK — grammar never lies about a line-locally-decidable construct"
  );
}

main().catch(err => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
