/** Classify lines delegated to embedded-language highlighting. */

import { lineClassifiers } from "@nota-lang/compiler/reader";

export type DelegationReason = "percent" | "statement-fence" | "code-fence";
export type LineClassification = readonly (DelegationReason | undefined)[];

const DELEGATED_FENCE_LANGS = new Set([
  "ts",
  "tsx",
  "typescript",
  "js",
  "jsx",
  "javascript",
  "json"
]);

const LINE_CLASSIFIERS = lineClassifiers();
const PERCENT_LINE = new RegExp(LINE_CLASSIFIERS.percentLine);
const FENCE_LINE = new RegExp(LINE_CLASSIFIERS.fenceLine);
const FENCE_CLOSE_LINE = new RegExp(LINE_CLASSIFIERS.fenceCloseLine);

// Keep these in sync with the procedural `scan_fenced_code` reader scan.
const BACKTICK_FENCE_OPEN = /^[ \t]*(`{3,})([^`\n]*)$/;
const BACKTICK_FENCE_CLOSE = /^[ \t]*(`+)/;

/** Return a delegation reason per source line. */
export function classifyLines(source: string): LineClassification {
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
        mode = { at: "markup" };
      } else {
        reasons[i] = "statement-fence";
      }
      continue;
    }
    if (mode.at === "code-fence") {
      const close = BACKTICK_FENCE_CLOSE.exec(line);
      if (close && close[1].length >= mode.ticks) {
        mode = { at: "markup" };
      } else if (mode.isDelegated) {
        reasons[i] = "code-fence";
      }
      continue;
    }
    if (FENCE_LINE.test(line)) {
      mode = { at: "statement-fence" };
      continue;
    }
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
      reasons[i] = "percent";
    }
  }
  return reasons;
}

/** Lines whose content is delegated to an embedded-language highlighter. */
export function delegatedLines(
  source: string,
  reasons = classifyLines(source)
): Set<number> {
  const out = new Set<number>();
  reasons.forEach((reason, i) => {
    if (reason !== undefined) out.add(i);
  });
  return out;
}

/** Statement- or code-fence interiors where markup completions are suppressed. */
export function literalFenceLines(
  source: string,
  reasons = classifyLines(source)
): Set<number> {
  const out = new Set<number>();
  reasons.forEach((reason, i) => {
    if (reason === "statement-fence" || reason === "code-fence") out.add(i);
  });
  return out;
}

/** Lines inside a `%%%` statement fence. */
export function statementFenceLines(
  source: string,
  reasons = classifyLines(source)
): Set<number> {
  const out = new Set<number>();
  reasons.forEach((reason, i) => {
    if (reason === "statement-fence") out.add(i);
  });
  return out;
}
