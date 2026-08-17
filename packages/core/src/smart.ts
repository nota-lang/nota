/**
 * Smart punctuation — Pollen's typography rules at the decode (Reforest) stage.
 *
 * The rules are transliterated from Pollen's `smart-quotes` / `smart-dashes` /
 * `smart-ellipses` (`pollen/unstable/typography.rkt`): seven ordered quote
 * replacements (apostrophes, sentence-ender closes, open/close by word
 * boundary), `---`→em / `--`→en dashes that eat surrounding space, and
 * `...`→`…`. Like Pollen's txexpr mode, quote *context* is judged over the
 * flattened text of the whole run — `_do '_@em{not'}` curls both quotes —
 * with excluded regions (code, math, …) contributing a neutral word-ish
 * placeholder so `` `code` ``'s apostrophe still reads as one.
 *
 * Two deliberate divergences from Pollen:
 *
 * 1. **Dashes eat horizontal whitespace only** (space/tab/nbsp, never `\n`) —
 *    a blank line inside a text child is Reforest's paragraph-break marker
 *    (`"\n\n"`), which a `\s`-greedy dash rule would destroy.
 * 2. The pass runs over Solid's *resolved* children — strings in place,
 *    client DOM via a text-node walk, server SSR chunks via an HTML-aware
 *    segment walk — so both sides transform the same text identically (the
 *    hydration contract). The transform is idempotent: curly quotes, `—`,
 *    `–`, and `…` are fixed points.
 *
 * Exclusions: text inside `code`/`pre`/`kbd`/`samp`/`script`/`style`/
 * `textarea`/`math`/`svg`, or any element carrying `data-nota-nosmart`, is
 * never touched (and reads as one opaque word for quote context).
 */

import { isSSRChunk, type ResolvedChild, type SSRChunk } from "./reforest";

/** Which smart-punctuation passes run (all default on); `false` disables the whole pass. */
export interface SmartOptions {
  /** Curly double/single quotes + apostrophes (Pollen's seven ordered rules). */
  quotes?: boolean;
  /** `---` → `—` (em), `--` → `–` (en); horizontal whitespace around them is eaten. */
  dashes?: boolean;
  /** `...` → `…`. */
  ellipses?: boolean;
}

/** Elements whose text is never smartened (and reads as one opaque word for quote context). */
const EXCLUDED_TAGS = new Set([
  "code",
  "pre",
  "kbd",
  "samp",
  "script",
  "style",
  "textarea",
  "math",
  "svg"
]);

/** The per-element opt-out attribute (`@span[data-nota-nosmart: true]{…}`). Module-internal: the
 * reader emits this string directly (a cross-language wire contract), and no TS package outside
 * this module consumes it either. */
const NOSMART_ATTR = "data-nota-nosmart";

/** HTML void elements (never push nesting depth in the chunk walk). */
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr"
]);

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * One transformable text region, or an opaque (excluded) region that only
 * contributes a neutral word-ish placeholder to quote context.
 */
type Segment =
  | { kind: "text"; get(): string; set(next: string): void }
  | { kind: "opaque" };

const OPAQUE: Segment = { kind: "opaque" };

// -------------------------------------------------------------------------------------------------
// The string rules (Pollen's, verbatim modulo the dash whitespace class)
// -------------------------------------------------------------------------------------------------

/** Pollen's sentence-ender exceptions: a quote before one of these closes even at a word gap. */
const ENDERS = ",.:;?!\\])}";

/** The seven ordered quote rules — each is a 1:1 character replacement (length-preserving). */
const QUOTE_RULES: [RegExp, string][] = [
  [/(?<=\w)'(?=\w)/g, "’"], // apostrophe
  [new RegExp(`(?<!\\w)'(?=[${ENDERS}])`, "g"), "’"], // ender on the outside
  [/(?<!\w)'(?=\S)/g, "‘"], // single at beginning
  [/(?<=\S)'(?!\w)/g, "’"], // single at end
  [new RegExp(`(?<!\\w)"(?=[${ENDERS}])`, "g"), "”"], // ender on the outside
  [/(?<!\w)"(?=\S)/g, "“"], // double at beginning
  [/(?<=\S)"(?!\w)/g, "”"] // double at end
];

/** Apply the quote rules to a flat string (1:1 — the output length equals the input length). */
export function smartQuotesString(text: string): string {
  let out = text;
  for (const [pattern, replacement] of QUOTE_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Horizontal whitespace (space/tab/nbsp — never `\n`, the paragraph-break contract). */
const H = "[ \\t\\u00A0]";
const EM_DASH = new RegExp(`${H}*(?:---|—)${H}*`, "g");
const EN_DASH = new RegExp(`${H}*(?:--|–)${H}*`, "g");

/** `---`→em then `--`→en (em first, else it would read as en+`-`), eating surrounding space. */
export function smartDashesString(text: string): string {
  return text.replace(EM_DASH, "—").replace(EN_DASH, "–");
}

/** `...` → `…`. */
export function smartEllipsesString(text: string): string {
  return text.replace(/\.{3}/g, "…");
}

// -------------------------------------------------------------------------------------------------
// The segment pass
// -------------------------------------------------------------------------------------------------

/**
 * Transform an ordered segment list: quotes first over the flattened context
 * (opaque segments read as the word `x`; 1:1 replacement redistributes
 * exactly), then dashes/ellipses per segment (length-changing, local).
 */
function smartenSegments(
  segments: Segment[],
  opts: Required<SmartOptions>
): void {
  if (opts.quotes) {
    const parts = segments.map(s => (s.kind === "text" ? s.get() : "x"));
    const converted = smartQuotesString(parts.join(""));
    let offset = 0;
    segments.forEach((s, i) => {
      const len = parts[i].length;
      if (s.kind === "text") {
        const next = converted.slice(offset, offset + len);
        if (next !== parts[i]) s.set(next);
      }
      offset += len;
    });
  }
  if (opts.dashes || opts.ellipses) {
    for (const s of segments) {
      if (s.kind !== "text") continue;
      const before = s.get();
      let next = before;
      if (opts.dashes) next = smartDashesString(next);
      if (opts.ellipses) next = smartEllipsesString(next);
      if (next !== before) s.set(next);
    }
  }
}

/** Push `seg`, collapsing runs of opaque segments into one placeholder. */
function push(out: Segment[], seg: Segment): void {
  if (seg.kind === "opaque" && out[out.length - 1]?.kind === "opaque") return;
  out.push(seg);
}

// --- client: DOM text-node walk ------------------------------------------------------------------

function collectNodeSegments(node: Node, out: Segment[]): void {
  if (node.nodeType === TEXT_NODE) {
    const text = node as Text;
    push(out, {
      kind: "text",
      get: () => text.data,
      set: next => {
        text.data = next;
      }
    });
    return;
  }
  if (node.nodeType !== ELEMENT_NODE) return; // comments etc.: invisible
  const el = node as Element;
  if (
    EXCLUDED_TAGS.has(el.tagName.toLowerCase()) ||
    el.hasAttribute(NOSMART_ATTR)
  ) {
    push(out, OPAQUE);
    return;
  }
  for (let child = el.firstChild; child; child = child.nextSibling) {
    collectNodeSegments(child, out);
  }
}

// --- server: SSR-chunk HTML segment walk ---------------------------------------------------------

/** A comment (`<!--#-->` hydration markers included) or a tag; attr values may hold `>`/quotes. */
const TAG_OR_COMMENT =
  /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

interface ChunkPatch {
  start: number;
  end: number;
  value: string;
}

/**
 * Walk one serialized chunk: text runs outside excluded elements become
 * writable segments (patched back into the string by the returned finalizer);
 * excluded interiors become opaque placeholders; comments are invisible.
 * Entities in text are left as-is (only `&`/`<` are entity-escaped in Solid's
 * text output — neither is a smartening target).
 */
function collectChunkSegments(
  chunk: SSRChunk,
  out: Segment[]
): (() => SSRChunk | null) | null {
  const html = chunk.t;
  const patches: ChunkPatch[] = [];
  const stack: boolean[] = []; // per open element: is it (or an ancestor) excluded?
  let excludedDepth = 0;
  let last = 0;
  let touched = false;

  const pushText = (start: number, end: number) => {
    if (end <= start) return;
    if (excludedDepth > 0) {
      push(out, OPAQUE);
      return;
    }
    const patch: ChunkPatch = { start, end, value: html.slice(start, end) };
    patches.push(patch);
    push(out, {
      kind: "text",
      get: () => patch.value,
      set: next => {
        patch.value = next;
        touched = true;
      }
    });
  };

  TAG_OR_COMMENT.lastIndex = 0;
  for (let m = TAG_OR_COMMENT.exec(html); m; m = TAG_OR_COMMENT.exec(html)) {
    pushText(last, m.index);
    last = TAG_OR_COMMENT.lastIndex;
    if (m[0].startsWith("<!--")) continue; // comments (hydration markers): invisible
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    if (closing) {
      // Serializer output is well-nested: pop the matching open.
      const wasExcluded = stack.pop() ?? false;
      if (wasExcluded) excludedDepth = Math.max(0, excludedDepth - 1);
    } else if (!VOID_TAGS.has(name) && !m[3].endsWith("/")) {
      const excluded = EXCLUDED_TAGS.has(name) || m[3].includes(NOSMART_ATTR);
      stack.push(excluded);
      if (excluded) excludedDepth += 1;
    }
  }
  pushText(last, html.length);

  if (patches.length === 0) return null;
  return () => {
    if (!touched) return null;
    let rebuilt = "";
    let from = 0;
    for (const patch of patches) {
      rebuilt += html.slice(from, patch.start) + patch.value;
      from = patch.end;
    }
    rebuilt += html.slice(from);
    return { t: rebuilt };
  };
}

// -------------------------------------------------------------------------------------------------
// Entry
// -------------------------------------------------------------------------------------------------

const DEFAULTS: Required<SmartOptions> = {
  quotes: true,
  dashes: true,
  ellipses: true
};

/**
 * Smarten a resolved-children array (see the module docs): strings are
 * replaced, client DOM text nodes are mutated in place, SSR chunks are
 * rebuilt. Returns the (possibly new) array; `false` disables the pass.
 */
export function smarten(
  resolved: ResolvedChild[],
  options?: SmartOptions | false
): ResolvedChild[] {
  if (options === false) return resolved;
  const opts = { ...DEFAULTS, ...(options ?? {}) };
  if (!opts.quotes && !opts.dashes && !opts.ellipses) return resolved;

  const result = [...resolved];
  const segments: Segment[] = [];
  const finalizers: (() => void)[] = [];

  result.forEach((child, i) => {
    if (typeof child === "string") {
      push(segments, {
        kind: "text",
        get: () => result[i] as string,
        set: next => {
          result[i] = next;
        }
      });
    } else if (isSSRChunk(child)) {
      const finalize = collectChunkSegments(child, segments);
      if (finalize) {
        finalizers.push(() => {
          const rebuilt = finalize();
          if (rebuilt) result[i] = rebuilt;
        });
      }
    } else if (typeof Node !== "undefined" && child instanceof Node) {
      collectNodeSegments(child, segments);
    }
    // numbers / booleans / null: nothing to transform
  });

  smartenSegments(segments, opts);
  for (const finalize of finalizers) finalize();
  return result;
}
