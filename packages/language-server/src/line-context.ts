/**
 * **Document line classification** — one state-machine walk over a `.nota` source's lines that
 * every "is this line delegated to an embedded grammar, or a literal fence body?" feature in this
 * package shares, instead of re-deriving the `%`/`%%%`/backtick-fence open/close tracking per
 * consumer (`semantic-tokens.ts`'s token-suppression; `completions.ts`'s `@`-completion suppression
 * + fenced-statement component scanning, via `server-core.ts`'s completion call site).
 *
 * Three reasons a line can be classified (or none — plain markup):
 * - `"percent"` — a bare `%` statement line. The rest of the line is genuinely Nota-lexed JS/TS
 *   (the reader's `collect_percent_statements` loops `parse_statement_list_item`), so `@div[…]` on
 *   it re-enters markup for real — this reason is informational only; nothing in this package
 *   suppresses on it (see `completions.ts`'s `headContext` doc).
 * - `"statement-fence"` — a line inside a `%%%` … `%%%` fence body (not its delimiter lines). The
 *   SAME statement parser as `"percent"` runs over fence bodies (`collect_fence_statements` also
 *   loops `parse_statement_list_item`), so `@` re-entry is grammatically just as legal there — but
 *   multi-line, so only a full-document walk (this one) can see it, unlike `headContext`'s
 *   single-line prefix.
 * - `"code-fence"` — a line inside a backtick code-fence body tagged with a language this package
 *   ships an embedded grammar for ({@link DELEGATED_FENCE_LANGS}). Genuinely opaque: the reader
 *   does not tokenize this text as Nota markup/JS at all (`scan_fenced_code` captures it as one
 *   flat `code` span).
 */

import { lineClassifiers } from "@nota-lang/compiler/reader";

/** Why a line is delegated (see the module doc for what each reason means). */
export type DelegationReason = "percent" | "statement-fence" | "code-fence";

/** The fence language tags a backtick code fence is opaque/delegated for (mirrors the editor's own
 *  embedded-grammar set — `codemirror`'s highlighting is the live consumer). */
const DELEGATED_FENCE_LANGS = new Set([
  "ts",
  "tsx",
  "typescript",
  "js",
  "jsx",
  "javascript",
  "json"
]);

// The reader's own line-classifier patterns (the lexer's regex sources over the wasm boundary)
// drive the `%`-line/fence-delimiter rules below, so those can no longer diverge from the parse.
const LINE_CLASSIFIERS = lineClassifiers();
const PERCENT_LINE = new RegExp(LINE_CLASSIFIERS.percentLine);
const FENCE_LINE = new RegExp(LINE_CLASSIFIERS.fenceLine);
const FENCE_CLOSE_LINE = new RegExp(LINE_CLASSIFIERS.fenceCloseLine);

/**
 * The backtick fence (```` ``` ````) has **no exported reader classifier** — unlike the `%`
 * patterns above, `scan_fenced_code` (`oxc/crates/oxc_parser/src/lexer/nota.rs`) is a procedural
 * scan, not a regex the wasm boundary can hand over — so these two are a **hand transliteration**
 * of its open/close rules, and CAN silently drift if that scan changes (it already had: see the
 * fence matrix in `tests/semantic-tokens-nota.test.ts`, which pins the two rules that had drifted).
 *
 * - **Open** — a run of ≥3 backticks (leading indentation tolerated, unbounded), whose same-line
 *   tail contains no backtick and is not the file's last line (a fence needs a body-starting
 *   newline after it). The tail's first whitespace-delimited token is the language tag.
 * - **Close** — a line whose first non-whitespace (after skipping only spaces/tabs, same as the
 *   open) is a run of **at least** the open's tick count. Trailing content after that run —
 *   more ticks, prose, anything — is allowed and is NOT required to be backtick-free; the reader
 *   resumes right after the closing run and leaves the rest of the line to whatever follows.
 *   (The two most common ways this was previously wrong: requiring an *exact* tick-count match,
 *   and requiring the close line to contain *only* the ticks.)
 */
const BACKTICK_FENCE_OPEN = /^[ \t]*(`{3,})([^`\n]*)$/;
const BACKTICK_FENCE_CLOSE = /^[ \t]*(`+)/;

/**
 * Classify every 0-based line of `source`: the {@link DelegationReason} it's delegated for, or
 * `undefined` for plain markup. One state-machine walk — every export below derives its `Set` from
 * this instead of re-tracking fence open/close itself.
 */
function classifyLines(source: string): (DelegationReason | undefined)[] {
  const lines = source.split("\n");
  const reasons: (DelegationReason | undefined)[] = new Array(lines.length);
  type Mode =
    | { at: "markup" }
    | { at: "statement-fence" }
    | { at: "code-fence"; ticks: number; isDelegated: boolean };
  let mode: Mode = { at: "markup" };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (mode.at === "statement-fence") {
      if (FENCE_CLOSE_LINE.test(line)) {
        mode = { at: "markup" }; // closing delimiter line — not delegated
      } else {
        reasons[i] = "statement-fence";
      }
      continue;
    }
    if (mode.at === "code-fence") {
      const close = BACKTICK_FENCE_CLOSE.exec(line);
      if (close && close[1].length >= mode.ticks) {
        mode = { at: "markup" }; // closing delimiter line — not delegated
      } else if (mode.isDelegated) {
        reasons[i] = "code-fence";
      }
      continue;
    }
    // markup context
    if (FENCE_LINE.test(line)) {
      mode = { at: "statement-fence" };
      continue;
    }
    // `i < lines.length - 1`: a fence needs a body, i.e. a newline after the opener line — true
    // for every split-produced line except (by construction) the last, which never had one.
    const open = i < lines.length - 1 ? BACKTICK_FENCE_OPEN.exec(line) : null;
    if (open) {
      const lang = open[2].trim().split(/\s+/)[0] ?? "";
      mode = {
        at: "code-fence",
        ticks: open[1].length,
        isDelegated: DELEGATED_FENCE_LANGS.has(lang.toLowerCase())
      };
      continue;
    }
    if (PERCENT_LINE.test(line)) {
      reasons[i] = "percent"; // `%` statement line: rest-of-line is embedded JS/TS
    }
  }
  return reasons;
}

/**
 * The 0-based lines whose content belongs to an embedded language — `%` statement lines, `%%%`
 * statement-fence interiors, and the interiors of code fences whose language tag we ship an
 * embedded grammar for ({@link DELEGATED_FENCE_LANGS}). Fence *delimiter* lines are not
 * delegated. Consumed by `semantic-tokens.ts` to suppress the reader's coarse JS-kind tokens where
 * a richer embedded grammar already paints them.
 */
export function delegatedLines(source: string): Set<number> {
  const out = new Set<number>();
  classifyLines(source).forEach((reason, i) => {
    if (reason !== undefined) out.add(i);
  });
  return out;
}

/**
 * The 0-based lines inside a **literal fence interior** — a `%%%` statement-fence body or a
 * delegated-language backtick code-fence body — as opposed to a bare `%` statement line.
 *
 * Grammar-wise a `%%%` body is not actually more "literal" than a `%` line: the reader runs the
 * identical statement parser over both (`collect_fence_statements`/`collect_percent_statements`
 * both loop `parse_statement_list_item`), so `@div[…]` re-enters markup there exactly as it does on
 * a `%` line — which is why {@link delegatedLines} and the semantic-token tier never suppress the
 * markup *kinds* in either. But a fence body is where a document holds a free-form multi-line block
 * of code, where an `@` is far likelier to be a decorator/stray character mid-typing than a
 * deliberate switch to markup — so `completions.ts`'s `@`-completion suppression treats a fence
 * body as literal even though the grammar would accept an `@` re-entry there. `headContext` only
 * ever sees a single line's prefix, so it cannot detect "am I inside a still-open fence" itself —
 * this full-document classification is consulted at the completion call site instead
 * (`server-core.ts`).
 */
export function literalFenceLines(source: string): Set<number> {
  const out = new Set<number>();
  classifyLines(source).forEach((reason, i) => {
    if (reason === "statement-fence" || reason === "code-fence") out.add(i);
  });
  return out;
}

/**
 * The 0-based lines inside a `%%%` statement-fence body specifically — excluding a bare `%` line
 * and excluding backtick code-fence bodies (opaque example text, not live bindings). Consumed by
 * `completions.ts`'s `scanComponents` to find component bindings declared inside a fence, whose
 * lines carry no leading `%` (only the fence's own delimiter lines do), so the `%+`-anchored regex
 * that finds a bare `%let Foo = …` binding can't see them either.
 */
export function statementFenceLines(source: string): Set<number> {
  const out = new Set<number>();
  classifyLines(source).forEach((reason, i) => {
    if (reason === "statement-fence") out.add(i);
  });
  return out;
}
