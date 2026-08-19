/** Convert reader highlight spans into non-overlapping LSP semantic tokens. */

import { highlightSpans } from "@nota-lang/compiler";
import type {
  LanguageServicePlugin,
  SemanticToken,
  SemanticTokensLegend
} from "@volar/language-server";
import { makeByteConverter } from "./byte-offsets.js";
import { delegatedLines } from "./line-context.js";

export { delegatedLines } from "./line-context.js";

/** Semantic-token types emitted by {@link notaSemanticTokens}. */
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

export const NOTA_TOKEN_MODIFIERS = [
  "notaHeading",
  "notaStrong",
  "notaEmphasis",
  "notaStrike",
  "notaMath"
] as const;

export const NOTA_SEMANTIC_LEGEND: SemanticTokensLegend = {
  tokenTypes: [...NOTA_TOKEN_TYPES],
  tokenModifiers: [...NOTA_TOKEN_MODIFIERS]
};

const typeIndex = (name: (typeof NOTA_TOKEN_TYPES)[number]): number =>
  NOTA_TOKEN_TYPES.indexOf(name);
const modBit = (name: (typeof NOTA_TOKEN_MODIFIERS)[number]): number =>
  1 << NOTA_TOKEN_MODIFIERS.indexOf(name);

// Under-layers contribute modifiers when a more specific token overlays them.
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

interface IndexedSpan {
  start: number;
  end: number;
  kind: string;
  index: number;
}

function bucket<K>(map: Map<K, IndexedSpan[]>, key: K, s: IndexedSpan): void {
  const list = map.get(key);
  if (list) {
    list.push(s);
  } else {
    map.set(key, [s]);
  }
}

/** Flatten paint-ordered spans with a sweep line and coalesce identical adjacent runs. */
export function flattenSpans(
  spans: { start: number; end: number; kind: string }[]
): TokenRun[] {
  if (spans.length === 0) {
    return [];
  }
  const bounds = [...new Set(spans.flatMap(s => [s.start, s.end]))].sort(
    (a, b) => a - b
  );

  // Exclude empty spans before building the active-set indexes.
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

    // Preserve paint order while updating the active spans.
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
      continue;
    }
    const prev = runs[runs.length - 1];
    if (
      prev &&
      prev.end === lo &&
      prev.tokenType === tokenType &&
      prev.modifiers === modifiers &&
      prev.kind === kind
    ) {
      prev.end = hi;
    } else {
      runs.push({ start: lo, end: hi, tokenType, modifiers, kind });
    }
  }
  return runs;
}

// Native embedded-language modes provide richer highlighting for these kinds.
const SUPPRESSED_ON_DELEGATED = new Set([
  "js-keyword",
  "js-string",
  "js-number",
  "js-comment",
  "js-operator",
  "code"
]);

/** Convert reader byte offsets to LSP positions. */
export function makeByteToPosition(
  source: string
): (byte: number) => { line: number; character: number } {
  return makeByteConverter(source).toPosition;
}

/** Return absolute semantic tokens for a Nota source. */
export function notaSemanticTokens(source: string): SemanticToken[] {
  const spans = highlightSpans(source);
  const runs = flattenSpans(spans);
  const posAt = makeByteToPosition(source);
  const delegated = delegatedLines(source);
  // LSP tokens cannot span lines, so split runs at newline bytes.
  const bytes = new TextEncoder().encode(source);
  const tokens: SemanticToken[] = [];
  for (const run of runs) {
    const suppressible = SUPPRESSED_ON_DELEGATED.has(run.kind);
    let segStart = run.start;
    while (segStart < run.end) {
      let nl = segStart;
      while (nl < run.end && bytes[nl] !== 10 /* \n */) {
        nl++;
      }
      const start = posAt(segStart);
      const length = posAt(nl).character - start.character;
      if (length > 0 && !(suppressible && delegated.has(start.line))) {
        tokens.push([
          start.line,
          start.character,
          length,
          run.tokenType,
          run.modifiers
        ]);
      }
      segStart = nl + 1;
    }
  }
  return tokens;
}

/** Remap local token indices to the advertised legend and delta-encode them for LSP. */
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
      continue;
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

/** Capability-only plugin; source-document requests are routed in `server-core.ts`. */
export const notaSemanticTokensPlugin: LanguageServicePlugin = {
  name: "nota-semantic-tokens",
  capabilities: {
    semanticTokensProvider: { legend: NOTA_SEMANTIC_LEGEND }
  },
  create: () => ({})
};
