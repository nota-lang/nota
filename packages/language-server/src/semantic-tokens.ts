/**
 * **Reader-driven semantic tokens.**
 *
 * The reader's `highlight()` pass already classifies the *whole* `.nota` — markup sigils, tag names,
 * prop names, and the embedded-JS token classes — tracking the markup⇄JS mutual nesting a TextMate-
 * style grammar structurally cannot. This module serves those spans as LSP semantic tokens over the
 * connection (see `server-core.ts`'s module doc for why that's a connection-level override, not this
 * module's own `LanguageServicePlugin`), so any LSP client gets the same faithful highlighting — VS
 * Code via `vscode-languageclient`, Emacs via `eglot` (both launching the same `bin.ts` binary).
 *
 * The reader emits spans in **paint order** (outer under-layers before the overlays they contain);
 * LSP semantic tokens must be **non-overlapping**. Following tinymist's `tokenize_tree`, we flatten
 * the overlapping spans into non-overlapping runs: the topmost overlay at each byte determines the
 * token **type**, and the five *under-layer* kinds (`heading`, `emphasis-strong`, `emphasis-em`,
 * `emphasis-strike`, `math`) become **modifier** bits on the runs they cover (with a base type when
 * they are the only cover — e.g. a heading's or emphasis's text).
 *
 * Spans are **source-native** byte offsets — no preamble/mapping shift — so this plugin operates on
 * the `.nota` document directly (unlike `volar-service-typescript`, which maps virtual-`.tsx` tokens
 * back). The reader's classes cover embedded JS too, so this is the sole semantic-token source
 * (reader-only); it caches the last-good tokens per document and serves them when
 * `highlight` throws mid-edit (editor parity with the playground).
 *
 * **Delegation-aware suppression.** This rationale was originally written against the deleted
 * vscode-nota package's TextMate grammar (a `source.ts`/`source.json` `contentName` embedding); the
 * live analogue is `editors/emacs/nota-mode.el`'s native font-lock delegation — for BOTH a `%`
 * statement line's rest and a `%%%`/ts/js/json fence interior, it copies real faces out of a hidden
 * buffer running Emacs's own major mode (its own doc calls this "the Emacs analogue of the TextMate
 * grammar's source.ts delegation, which the server's semantic tokens deliberately defer to on these
 * lines"). `@nota-lang/codemirror` is a *narrower* case of the same idea: it sub-tokenizes code-fence
 * and math interiors with CM's own parsers, but paints `%` lines straight from the reader's own
 * (unsuppressed) token classes — this LSP suppression has no bearing on it there.
 *
 * Either way, a real per-language mode/grammar paints those bytes *richer* than the reader's coarse
 * token classes (`storage.type.function.arrow` vs a generic `operator`; a real function-name face vs
 * nothing for a plain identifier). A second, coarser paint on the same bytes would flicker
 * grammar-color → semantic-color on every keystroke and downgrade the palette (the user-visible "`=>`
 * is blue and red" bug). So on delegation-legal lines ({@link delegatedLines}, `./line-context.ts`)
 * the embedded-JS and raw-code kinds are **suppressed** here, ceding those bytes to whatever native
 * fontification the client provides; the markup kinds (sigils, tags, prop names, interpolations —
 * exactly what an embedded JS/TS grammar gets wrong on markup re-entry like `@div[…]` inside JS)
 * still overlay everywhere, including on delegated lines.
 */

import { highlightSpans } from "@nota-lang/compiler";
import type {
  LanguageServicePlugin,
  SemanticToken,
  SemanticTokensLegend
} from "@volar/language-server";
import { makeByteConverter } from "./byte-offsets.js";
import { delegatedLines } from "./line-context.js";

// Re-exported for existing consumers (`tests/semantic-tokens-nota.test.ts`) — `delegatedLines` now
// lives in `./line-context.ts` alongside `literalFenceLines`/`statementFenceLines`, the fence/line
// classifiers `completions.ts` and `server-core.ts` also consume (module doc there).
export { delegatedLines } from "./line-context.js";

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

/** A span carrying its position in the caller's array — the sweep in {@link flattenSpans} needs this
 *  to break exact-duplicate-range ties the same way a plain left-to-right array scan would. */
interface IndexedSpan {
  start: number;
  end: number;
  kind: string;
  index: number;
}

/** Push `s` onto `map.get(key)`, creating the bucket on first use. */
function bucket<K>(map: Map<K, IndexedSpan[]>, key: K, s: IndexedSpan): void {
  const list = map.get(key);
  if (list) {
    list.push(s);
  } else {
    map.set(key, [s]);
  }
}

/**
 * Flatten the reader's overlapping paint-order spans into non-overlapping {@link TokenRun}s
 * (tinymist's slicing). At each byte, the innermost overlay determines the type; the five
 * under-layer kinds contribute modifier bits (and a base type when they are the only cover).
 * Adjacent runs with identical `(type, modifiers)` are coalesced.
 *
 * A **sweep-line merge**: each span is added to the `active` set exactly once (at its start
 * boundary) and removed exactly once (at its end boundary) — O(spans) add/remove total, with
 * `active`'s size bounded by the markup's nesting depth at that point (small and roughly constant
 * in practice), not by the total span count. The winner-selection logic per interval is unchanged
 * from a plain left-to-right scan — a prior version re-scanned the FULL span list at every boundary
 * (O(boundaries × spans): fine for one document, wasteful on every keystroke's re-highlight of a
 * large one) — `active` is kept sorted by each span's original array index so the strict-inequality
 * tie-breaks below see candidates in the same relative order that full re-scan did.
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

  // Index spans by where they start/end covering an interval. Zero/negative-width spans never
  // cover any `[lo, hi)` (`hi > lo` always, so `s.end <= s.start` can't satisfy `s.end >= hi`) —
  // excluded up front so they never enter `active` (an add and remove at the identical boundary,
  // in that order, would otherwise leave a phantom entry `active` never removes again).
  const startsAt = new Map<number, IndexedSpan[]>();
  const endsAt = new Map<number, IndexedSpan[]>();
  spans.forEach((s, index) => {
    if (s.end <= s.start) {
      return;
    }
    const indexed: IndexedSpan = { ...s, index };
    bucket(startsAt, s.start, indexed);
    bucket(endsAt, s.end, indexed);
  });

  const active: IndexedSpan[] = [];
  const runs: TokenRun[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const lo = bounds[i];
    const hi = bounds[i + 1];

    // Retire spans ending exactly at `lo` (they don't cover `[lo, hi)`), then admit spans starting
    // exactly at `lo` — inserted at their original-index position so `active` stays index-ordered.
    for (const s of endsAt.get(lo) ?? []) {
      const at = active.indexOf(s);
      if (at >= 0) {
        active.splice(at, 1);
      }
    }
    for (const s of startsAt.get(lo) ?? []) {
      let at = active.findIndex(a => a.index > s.index);
      if (at < 0) {
        at = active.length;
      }
      active.splice(at, 0, s);
    }

    if (hi <= lo || active.length === 0) {
      continue;
    }

    // Innermost overlay (largest start, then smallest end) and the union of under-layer modifiers —
    // identical selection rules over `active` (spans covering this interval) as the old full scan.
    let overlay = -1;
    let overlayKind = "";
    let overlayStart = -1;
    let overlayEnd = Number.MAX_SAFE_INTEGER;
    let modifiers = 0;
    let modBase = -1;
    let modBaseKind = "";
    let modBaseStart = -1;
    for (const s of active) {
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
 * raw-code interior (module doc's **Delegation-aware suppression** section — the live
 * per-client-native-mode rationale, arrows as `storage.type.function.arrow` vs a generic `operator`,
 * call names as `entity.name.function` vs nothing). Markup kinds are never suppressed: they cover
 * exactly the markup re-entry an embedded JS/TS mode mis-reads (`@div[…]` inside JS looks like a
 * decorator/array to it).
 */
const SUPPRESSED_ON_DELEGATED = new Set([
  "js-keyword",
  "js-string",
  "js-number",
  "js-comment",
  "js-operator",
  "code"
]);

/**
 * Convert `.nota` **byte** offsets (the reader's spans) to LSP **UTF-16** `(line, character)`
 * positions — a thin wrapper over the package-shared {@link makeByteConverter} (`./byte-offsets.ts`;
 * also used at the Volar mapping boundary in `language-plugin.ts` and by `diagnostics.ts`), kept as
 * its own named export since this module's tests exercise it directly.
 */
export function makeByteToPosition(
  source: string
): (byte: number) => { line: number; character: number } {
  return makeByteConverter(source).toPosition;
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
  // one token per line — a single LSP semantic token cannot span a newline. `TextEncoder`, not
  // `Buffer`: this pipeline is shared with the browser Web Worker flavor (`browser.ts`), which has
  // no `Buffer` global — a prior `Buffer.from` here threw on every call, silently swallowed by the
  // last-good-cache `catch` in `server-core.ts`, so the browser flavor served permanently-empty
  // semantic tokens.
  const bytes = new TextEncoder().encode(source);
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
      // Per-line suppression: the client's own native mode/grammar owns this segment (module doc's
      // Delegation-aware suppression). Checked per line-segment (not per run) so a run straddling a
      // delegated and a non-delegated line — a template literal continuing past a `%` line — keeps
      // its non-delegated part painted.
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
 * `.tsx` — see the source-document routing note in `server-core.ts`'s module doc), so the
 * connection-level handler serves these tokens directly — and it
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
 * The Nota semantic-tokens Volar service plugin. Registered purely so its `semanticTokensProvider`
 * capability (the legend) merges into the server's advertised capabilities — `create()` is a no-op
 * because Volar's `languageFeatureWorker` never offers a service plugin the `.nota` source doc (only
 * the generated virtual `.tsx`, which has no reader-driven tokens to serve), so a
 * `provideDocumentSemanticTokens` here would never run (it used to exist anyway, duplicating verbatim
 * the last-good-cache logic the live path also needs). The live path is `readerTokens` inside
 * `registerNotaConnectionFeatures` (`server-core.ts`), which calls {@link notaSemanticTokens} directly
 * and owns the one real last-good cache, serving both `full` and `onRange` at the connection level.
 */
export const notaSemanticTokensPlugin: LanguageServicePlugin = {
  name: "nota-semantic-tokens",
  capabilities: {
    semanticTokensProvider: { legend: NOTA_SEMANTIC_LEGEND }
  },
  create: () => ({})
};
