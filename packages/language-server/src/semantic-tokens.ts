/**
 * **Reader-driven semantic tokens.**
 *
 * The reader's `highlight()` pass already classifies the *whole* `.nota` — markup sigils, tag names,
 * prop names, and the embedded-JS token classes — tracking the markup⇄JS mutual nesting a TextMate
 * grammar structurally cannot (that is why the CodeMirror playground paints these directly). This
 * module serves those spans as LSP semantic tokens from a Nota Volar service plugin, so VS Code gets
 * the same faithful highlighting.
 *
 * The reader emits spans in **paint order** (outer under-layers before the overlays they contain);
 * LSP semantic tokens must be **non-overlapping**. Following tinymist's `tokenize_tree`, we flatten
 * the overlapping spans into non-overlapping runs: the topmost overlay at each byte determines the
 * token **type**, and the four *under-layer* kinds (`heading`, `emphasis-strong`, `emphasis-em`,
 * `math`) become **modifier** bits on the runs they cover (with a base type when they are the only
 * cover — e.g. a heading's or emphasis's text).
 *
 * Spans are **source-native** byte offsets — no preamble/mapping shift — so this plugin operates on
 * the `.nota` document directly (unlike `volar-service-typescript`, which maps virtual-`.tsx` tokens
 * back). The reader's classes cover embedded JS too, so this is the sole semantic-token source
 * (reader-only); it caches the last-good tokens per document and serves them when
 * `highlight` throws mid-edit (editor parity with the playground).
 *
 * **Delegation-aware suppression.** On lines the TextMate grammar delegates to a real embedded
 * grammar — `%` statement lines, `%%%` fence interiors, and ts/js/json code-fence interiors — the
 * grammar's `source.ts`/`source.json` paint is *richer* than the reader's coarse token classes
 * (`storage.type.function.arrow.ts` vs a generic `operator`; `entity.name.function` vs nothing for a
 * plain identifier). Emitting our coarse tokens there makes every keystroke flicker grammar-color →
 * semantic-color and permanently downgrades the palette (the user-visible "`=>` is blue and red"
 * bug). So on delegation-legal lines ({@link delegatedLines} — the same classifier as the
 * vscode-nota conformance test) the embedded-JS and raw-code kinds are **suppressed** and TextMate
 * owns those bytes; the markup kinds (sigils, tags, prop names, interpolations — exactly what the
 * embedded grammar gets wrong on markup re-entry like `@div[…]` inside JS) still overlay everywhere.
 */

import { highlightSpans } from "@nota-lang/compiler";
import { lineClassifiers } from "@nota-lang/compiler/reader";
import type {
  LanguageServicePlugin,
  SemanticToken,
  SemanticTokensLegend
} from "@volar/language-server";
import { NOTA_LANGUAGE_ID } from "./language-plugin.js";

/**
 * The semantic-token **type legend** (the plugin returns indices into this; Volar remaps to the
 * client's merged legend). Standard LSP types where natural (`keyword`/`string`/`number`/`comment`/
 * `operator`/`variable`/`property`/`class`), Nota-specific `nota*` types for the markup structure.
 */
export const NOTA_TOKEN_TYPES = [
  // standard LSP types (reused where the reader kind maps naturally)
  "keyword",
  "string",
  "number",
  "comment",
  "operator",
  "variable",
  "property",
  "class",
  // Nota-specific markup types
  "notaSigil",
  "notaTag",
  "notaHeadingMarker",
  "notaHeading",
  "notaListMarker",
  "notaEmphasis",
  "notaMathDelim",
  "notaMath",
  "notaCodeDelim",
  "notaCodeLang",
  "notaCode",
  "notaVerbatim",
  "notaEscape",
  "notaStyle"
] as const;

/** The semantic-token **modifier legend** — the five Nota under-layers ride as modifier bits. */
export const NOTA_TOKEN_MODIFIERS = [
  "notaHeading",
  "notaStrong",
  "notaEmphasis",
  "notaStrike",
  "notaMath"
] as const;

/** The Volar `SemanticTokensLegend` this plugin advertises. */
export const NOTA_SEMANTIC_LEGEND: SemanticTokensLegend = {
  tokenTypes: [...NOTA_TOKEN_TYPES],
  tokenModifiers: [...NOTA_TOKEN_MODIFIERS]
};

const typeIndex = (name: (typeof NOTA_TOKEN_TYPES)[number]): number =>
  NOTA_TOKEN_TYPES.indexOf(name);
const modBit = (name: (typeof NOTA_TOKEN_MODIFIERS)[number]): number =>
  1 << NOTA_TOKEN_MODIFIERS.indexOf(name);

/**
 * The five **under-layer** highlight kinds: each contributes a modifier bit, and a base token type
 * for the runs it covers alone (a heading's/emphasis's/math's text). When an overlay covers the same
 * bytes, the overlay wins the type and the under-layer rides as a modifier only.
 */
const UNDER_LAYERS: Record<string, { base: number; modifier: number }> = {
  heading: { base: typeIndex("notaHeading"), modifier: modBit("notaHeading") },
  "emphasis-strong": {
    base: typeIndex("notaEmphasis"),
    modifier: modBit("notaStrong")
  },
  "emphasis-em": {
    base: typeIndex("notaEmphasis"),
    modifier: modBit("notaEmphasis")
  },
  "emphasis-strike": {
    base: typeIndex("notaEmphasis"),
    modifier: modBit("notaStrike")
  },
  math: { base: typeIndex("notaMath"), modifier: modBit("notaMath") }
};

/** Map an *overlay* (non-under-layer) highlight-kind name to a token-type index, or `-1` if none. */
function overlayType(kind: string): number {
  switch (kind) {
    case "sigil":
      return typeIndex("notaSigil");
    case "tag-host":
      return typeIndex("notaTag");
    case "tag-component":
      return typeIndex("class");
    case "prop-name":
      return typeIndex("property");
    case "interpolation":
      return typeIndex("variable");
    case "control-keyword":
      return typeIndex("keyword");
    case "heading-marker":
      return typeIndex("notaHeadingMarker");
    case "list-marker":
      return typeIndex("notaListMarker");
    case "math-delim":
      return typeIndex("notaMathDelim");
    case "code-delim":
      return typeIndex("notaCodeDelim");
    case "code-lang":
      return typeIndex("notaCodeLang");
    case "code":
      return typeIndex("notaCode");
    case "verbatim":
      return typeIndex("notaVerbatim");
    case "escape":
      return typeIndex("notaEscape");
    case "js-keyword":
      return typeIndex("keyword");
    case "js-string":
      return typeIndex("string");
    case "js-number":
      return typeIndex("number");
    case "js-comment":
      return typeIndex("comment");
    case "js-operator":
      return typeIndex("operator");
    case "style-text":
      return typeIndex("notaStyle");
    case "comment":
      return typeIndex("comment");
    default:
      return -1;
  }
}

/** A flattened, non-overlapping token run over `.nota` byte offsets. */
export interface TokenRun {
  start: number;
  end: number;
  tokenType: number;
  modifiers: number;
  /** The reader kind that won this run (overlay kind, or under-layer base) — drives suppression. */
  kind: string;
}

/**
 * Flatten the reader's overlapping paint-order spans into non-overlapping {@link TokenRun}s
 * (tinymist's slicing). At each byte, the innermost overlay determines the type; the four
 * under-layer kinds contribute modifier bits (and a base type when they are the only cover).
 * Adjacent runs with identical `(type, modifiers)` are coalesced.
 */
export function flattenSpans(
  spans: { start: number; end: number; kind: string }[]
): TokenRun[] {
  if (spans.length === 0) {
    return [];
  }
  // All distinct boundary offsets, ascending.
  const bounds = [...new Set(spans.flatMap(s => [s.start, s.end]))].sort(
    (a, b) => a - b
  );

  const runs: TokenRun[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const lo = bounds[i];
    const hi = bounds[i + 1];
    if (hi <= lo) {
      continue;
    }
    // Innermost overlay (largest start, then smallest end) and the union of under-layer modifiers.
    let overlay = -1;
    let overlayKind = "";
    let overlayStart = -1;
    let overlayEnd = Number.MAX_SAFE_INTEGER;
    let modifiers = 0;
    let modBase = -1;
    let modBaseKind = "";
    let modBaseStart = -1;
    for (const s of spans) {
      if (s.start > lo || s.end < hi) {
        continue; // does not cover [lo, hi)
      }
      const under = UNDER_LAYERS[s.kind];
      if (under) {
        modifiers |= under.modifier;
        if (s.start > modBaseStart) {
          modBaseStart = s.start;
          modBase = under.base;
          modBaseKind = s.kind;
        }
        continue;
      }
      const t = overlayType(s.kind);
      if (t < 0) {
        continue;
      }
      // Innermost wins: later start, or same start + earlier end.
      if (
        s.start > overlayStart ||
        (s.start === overlayStart && s.end < overlayEnd)
      ) {
        overlay = t;
        overlayKind = s.kind;
        overlayStart = s.start;
        overlayEnd = s.end;
      }
    }
    const tokenType = overlay >= 0 ? overlay : modBase;
    const kind = overlay >= 0 ? overlayKind : modBaseKind;
    if (tokenType < 0) {
      continue; // covered only by things with no type (nothing to paint)
    }
    const prev = runs[runs.length - 1];
    if (
      prev &&
      prev.end === lo &&
      prev.tokenType === tokenType &&
      prev.modifiers === modifiers &&
      prev.kind === kind
    ) {
      prev.end = hi; // coalesce
    } else {
      runs.push({ start: lo, end: hi, tokenType, modifiers, kind });
    }
  }
  return runs;
}

/**
 * The reader kinds suppressed on {@link delegatedLines}: the embedded-JS token classes and the flat
 * raw-code interior. On those lines the TextMate grammar's real `source.ts`/`source.json` embedding
 * already paints richer, TS-convention colors (arrows as `storage.type.function.arrow`, call names
 * as `entity.name.function`) — our coarser classes would fight it (keystroke flicker + palette
 * downgrade). Markup kinds are never suppressed: they cover exactly the markup re-entry the embedded
 * grammar mis-reads (`@div[…]` inside JS looks like a decorator/array to TS).
 */
const SUPPRESSED_ON_DELEGATED = new Set([
  "js-keyword",
  "js-string",
  "js-number",
  "js-comment",
  "js-operator",
  "code"
]);

/** The fence language tags the grammar delegates to a real embedded grammar (mirrors the grammar). */
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
// — the `%`-line rules here can no longer diverge from the parse. The backtick fence has no
// exported classifier (a procedural scan), so its shape below mirrors the lexer's
// `scan_fenced_code`: ≥3 ticks, any backtick-free info string, first whitespace token = lang.
const LINE_CLASSIFIERS = lineClassifiers();
const PERCENT_LINE = new RegExp(LINE_CLASSIFIERS.percentLine);
const FENCE_LINE = new RegExp(LINE_CLASSIFIERS.fenceLine);
const FENCE_CLOSE_LINE = new RegExp(LINE_CLASSIFIERS.fenceCloseLine);

/**
 * The 0-based lines whose content belongs to an embedded language — `%` statement lines, `%%%`
 * statement-fence interiors, and the interiors of code fences whose language tag we ship an
 * embedded grammar for ({@link DELEGATED_FENCE_LANGS}). Fence *delimiter* lines are not
 * delegated (the reader's `code-delim`/`code-lang` kinds are not suppressed anyway). The
 * `%`-family classification consumes the reader's own patterns above.
 */
export function delegatedLines(source: string): Set<number> {
  const delegated = new Set<number>();
  const lines = source.split("\n");
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
        delegated.add(i);
      }
      continue;
    }
    if (mode.at === "code-fence") {
      const close = /^[ \t]*(`{3,})[ \t]*$/.exec(line);
      if (close && close[1].length === mode.ticks) {
        mode = { at: "markup" }; // closing delimiter line — not delegated
      } else if (mode.isDelegated) {
        delegated.add(i);
      }
      continue;
    }
    // markup context
    if (FENCE_LINE.test(line)) {
      mode = { at: "statement-fence" };
      continue;
    }
    const open = /^[ \t]*(`{3,})[ \t]*([^`\n]*)$/.exec(line);
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
      delegated.add(i); // `%` statement line: rest-of-line is embedded JS/TS
    }
  }
  return delegated;
}

/**
 * Convert `.nota` **byte** offsets (the reader's spans) to LSP **UTF-16** `(line, character)`
 * positions. The reader emits UTF-8 byte offsets; LSP positions count UTF-16 code units — they
 * coincide for ASCII but diverge on multibyte text, so we walk the source once by code point.
 * Returns `posAt(byte) → { line, character }` (nearest boundary at or below `byte`).
 */
export function makeByteToPosition(
  source: string
): (byte: number) => { line: number; character: number } {
  const checkpoints: { byte: number; line: number; character: number }[] = [];
  let byte = 0;
  let line = 0;
  let character = 0;
  for (let i = 0; i < source.length; ) {
    checkpoints.push({ byte, line, character });
    const cp = source.codePointAt(i) ?? 0;
    const utf16 = cp > 0xffff ? 2 : 1;
    const utf8 = cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
    if (cp === 10 /* \n */) {
      line++;
      character = 0;
    } else {
      character += utf16;
    }
    byte += utf8;
    i += utf16;
  }
  checkpoints.push({ byte, line, character });
  return (target: number) => {
    // Binary search for the greatest checkpoint whose byte <= target.
    let lo = 0;
    let hi = checkpoints.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (checkpoints[mid].byte <= target) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    const c = checkpoints[lo];
    // Within a single-code-unit ASCII stretch, interpolate the remaining columns.
    const delta = target - c.byte;
    return { line: c.line, character: c.character + delta };
  };
}

/**
 * Compute the reader-driven semantic tokens for `source` as Volar `SemanticToken`s
 * (`[line, character, length, tokenType, tokenModifiers]`, absolute). Throws only if the reader's
 * `highlight` throws (a parse failure) — the plugin catches that and serves its last-good cache.
 */
export function notaSemanticTokens(source: string): SemanticToken[] {
  const spans = highlightSpans(source);
  const runs = flattenSpans(spans);
  const posAt = makeByteToPosition(source);
  const delegated = delegatedLines(source);
  // Newline byte offsets, so a run that straddles lines (a block code/math fence) can be split into
  // one token per line — a single LSP semantic token cannot span a newline.
  const bytes = Buffer.from(source, "utf8");
  const tokens: SemanticToken[] = [];
  for (const run of runs) {
    const suppressible = SUPPRESSED_ON_DELEGATED.has(run.kind);
    let segStart = run.start;
    while (segStart < run.end) {
      // The end of this line-segment: the next `\n` within the run, or the run's end.
      let nl = segStart;
      while (nl < run.end && bytes[nl] !== 10 /* \n */) {
        nl++;
      }
      const start = posAt(segStart);
      const length = posAt(nl).character - start.character;
      // Per-line suppression: TextMate's embedded grammar owns this segment (module doc). Checked
      // per line-segment (not per run) so a run straddling a delegated and a non-delegated line —
      // a template literal continuing past a `%` line — keeps its non-delegated part painted.
      if (length > 0 && !(suppressible && delegated.has(start.line))) {
        tokens.push([
          start.line,
          start.character,
          length,
          run.tokenType,
          run.modifiers
        ]);
      }
      segStart = nl + 1; // skip the newline
    }
  }
  return tokens;
}

/**
 * Delta-encode plugin-local {@link SemanticToken}s into the LSP `SemanticTokens` wire shape
 * (`{ data }`, groups of 5) **remapped to a merged legend**.
 *
 * The service-plugin channel would remap our plugin-local type/modifier indices to the client legend
 * for us, but that channel never routes the `.nota` source doc to us (Volar offers only the virtual
 * `.tsx` — see the source-document routing note in `server.ts`), so the connection-level handler
 * serves these tokens directly — and it
 * MUST index them against the legend the server actually advertised. Volar merges the TS plugin's
 * legend first (`namespace`, …, `operator`), then ours (`notaSigil`, …), so a plugin-local index
 * (into {@link NOTA_TOKEN_TYPES}/{@link NOTA_TOKEN_MODIFIERS}) is the WRONG index in the merged
 * legend. We translate by NAME: local index → type/modifier name → its position in `legend`.
 *
 * Tokens whose type name is absent from `legend` are dropped (defensive; the merge always includes
 * ours). Modifier bits whose name is absent are dropped. Output is sorted + delta-encoded exactly as
 * Volar's `SemanticTokensBuilder` would.
 */
export function encodeSemanticTokens(
  tokens: readonly SemanticToken[],
  legend: SemanticTokensLegend
): { data: number[] } {
  const typeMap = NOTA_TOKEN_TYPES.map(name => legend.tokenTypes.indexOf(name));
  const modMap = NOTA_TOKEN_MODIFIERS.map(name =>
    legend.tokenModifiers.indexOf(name)
  );
  const remapped: SemanticToken[] = [];
  for (const [line, char, length, type, mods] of tokens) {
    const mergedType = typeMap[type] ?? -1;
    if (mergedType < 0) {
      continue; // type name not in the merged legend — nothing safe to paint
    }
    let mergedMods = 0;
    for (let i = 0; i < NOTA_TOKEN_MODIFIERS.length; i++) {
      if (mods & (1 << i) && modMap[i] >= 0) {
        mergedMods |= 1 << modMap[i];
      }
    }
    remapped.push([line, char, length, mergedType, mergedMods]);
  }
  remapped.sort((a, b) => (a[0] - b[0] === 0 ? a[1] - b[1] : a[0] - b[0]));
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const [line, char, length, type, mods] of remapped) {
    const deltaLine = line - prevLine;
    const deltaChar = deltaLine === 0 ? char - prevChar : char;
    data.push(deltaLine, deltaChar, length, type, mods);
    prevLine = line;
    prevChar = char;
  }
  return { data };
}

/**
 * The Nota semantic-tokens Volar service plugin. Serves `semanticTokens/full` (full only — no delta,
 * no range in v1) from the reader's `highlight` over the `.nota` source, with a last-good cache per
 * document served when `highlight` throws mid-edit.
 */
export const notaSemanticTokensPlugin: LanguageServicePlugin = {
  name: "nota-semantic-tokens",
  capabilities: {
    semanticTokensProvider: { legend: NOTA_SEMANTIC_LEGEND }
  },
  create() {
    // Last-good tokens per document uri — served when a mid-edit source fails to parse.
    const cache = new Map<string, SemanticToken[]>();
    return {
      provideDocumentSemanticTokens(document) {
        if (document.languageId !== NOTA_LANGUAGE_ID) {
          return undefined;
        }
        try {
          const tokens = notaSemanticTokens(document.getText());
          cache.set(document.uri, tokens);
          return tokens;
        } catch {
          // Reader threw (source mid-edit / unparseable) — serve the last-good tokens.
          return cache.get(document.uri) ?? [];
        }
      }
    };
  }
};
