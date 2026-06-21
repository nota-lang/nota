/**
 * **Shared feature harness** for the Phase-W language-feature tests (implementation.md §5.8 layer 3).
 *
 * Drives a real TS `LanguageService` directly over the virtual `.tsx` produced by {@link buildVirtual}
 * — the exact production spine (reader emit + typing preamble + shifted `CodeMapping`s) — and maps
 * positions/results back and forth through Volar's own `SourceMap` (`@volar/source-map`, re-exported by
 * `@volar/language-core`). This is the §5.8-sanctioned "drive the language service directly over the
 * virtual code + mappings" path, the same one `diagnostics.test.ts` uses; it lets every W feature
 * (hover/completion/definition/references/rename) be asserted at a `.nota` cursor without the heavier
 * Volar program/connection plumbing — `volar-service-typescript` is the thin LSP adapter over exactly
 * these same TS calls + mappings, so a green result here is faithful to what the running server yields.
 *
 * The capability gate (Volar's `CodeInformation`/`MappingCapabilities`) is exercised through the
 * `filter` argument both `toGeneratedLocation`/`toSourceLocation` accept — the same predicate Volar
 * applies per feature (e.g. a completion request only maps through ranges with `data.completion`). So
 * "this `.nota` range offers no completion" is asserted as "`gen(off, d => d.completion)` is `null`".
 *
 * Why a `.nota.tsx` filename for the in-memory virtual file: TS's language-service program filters
 * root files by known extension, so the virtual script is presented under a real `.tsx` name (its
 * *content* is `buildVirtual(...).code`). Mapping back to `.nota` uses our `CodeMapping`s, whose
 * `generatedOffsets` index exactly this content — so the round-trip is faithful to production.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MappingCapabilities } from "@nota-lang/compiler";
import { SourceMap } from "@volar/language-core";
import ts from "typescript";
import { buildVirtual } from "../src/language-plugin";

// `import.meta.dirname` is `<pkg>/tests`; the package root is where `node_modules` (runtime `.d.ts`,
// lib.d.ts) resolves so the virtual `.tsx`'s `@nota-lang/runtime` import type-checks.
const PKG_ROOT = resolve(import.meta.dirname, "..");

/** A capability predicate over a mapping's `data` (the Volar gate per feature). */
export type CapFilter = (data: MappingCapabilities) => boolean;

/**
 * A live virtual `.tsx` for one `.nota` source, with a real TS `LanguageService` over it and the
 * shifted `SourceMap` to translate `.nota` ⇄ `.tsx` offsets (gated by capabilities).
 */
export interface FeatureHarness {
  /** The TS language service running over the virtual `.tsx`. */
  ls: ts.LanguageService;
  /** The virtual file's name (a real `.tsx` so TS includes it in the program). */
  virtualFileName: string;
  /** The virtual `.tsx` source (preamble + bare emit). */
  code: string;
  /** Volar `SourceMap` over the shifted mappings. */
  sourceMap: SourceMap<MappingCapabilities>;
  /**
   * Map a `.nota` source offset to its generated `.tsx` offset (the first match), optionally gated by
   * a capability predicate. `null` when no mapping (or none satisfying `filter`) covers the offset —
   * which is exactly how a closed capability gate manifests.
   */
  gen(notaOffset: number, filter?: CapFilter): number | null;
  /** Map a generated `.tsx` offset back to its `.nota` source offset (first match), gated optionally. */
  src(genOffset: number, filter?: CapFilter): number | null;
}

/**
 * Build a {@link FeatureHarness} for a `.nota` source. Compiles via the production {@link buildVirtual}
 * (typing preamble + shifted mappings) and installs the result as a real-`.tsx` virtual file under a
 * TS language service configured like the editor's (strict, bundler resolution, ReactJSX).
 */
export function createFeatureHarness(notaSource: string): FeatureHarness {
  // A real `.tsx` extension so TS includes it in the program; the basename keeps the `.nota` origin
  // visible. Resolved under the package root so module resolution finds the workspace runtime types.
  const virtualFileName = resolve(PKG_ROOT, "__feature__.nota.tsx");

  const { code, mappings } = buildVirtual(notaSource);
  const sourceMap = new SourceMap<MappingCapabilities>(mappings);

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: []
  };

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => [virtualFileName],
    getScriptVersion: fileName => (fileName === virtualFileName ? "1" : "0"),
    getScriptSnapshot: fileName => {
      if (fileName === virtualFileName) {
        return ts.ScriptSnapshot.fromString(code);
      }
      if (existsSync(fileName)) {
        return ts.ScriptSnapshot.fromString(readFileSync(fileName, "utf8"));
      }
      return undefined;
    },
    getCurrentDirectory: () => PKG_ROOT,
    getDefaultLibFileName: opts => ts.getDefaultLibFilePath(opts),
    readFile: ts.sys.readFile,
    fileExists: ts.sys.fileExists,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    readDirectory: ts.sys.readDirectory,
    realpath: ts.sys.realpath
  };

  const ls = ts.createLanguageService(host);

  function gen(notaOffset: number, filter?: CapFilter): number | null {
    for (const [generatedOffset] of sourceMap.toGeneratedLocation(
      notaOffset,
      filter
    )) {
      return generatedOffset;
    }
    return null;
  }

  function src(genOffset: number, filter?: CapFilter): number | null {
    for (const [sourceOffset] of sourceMap.toSourceLocation(
      genOffset,
      filter
    )) {
      return sourceOffset;
    }
    return null;
  }

  return { ls, virtualFileName, code, sourceMap, gen, src };
}

/** Hover (`quickInfo`) display string at a `.nota` offset, or `null` if TS reports none. */
export function hoverAt(h: FeatureHarness, notaOffset: number): string | null {
  // Hover is gated by `semantic` (contract §9: semantic = semantic tokens + hover).
  const g = h.gen(notaOffset, d => d.semantic);
  if (g === null) {
    return null;
  }
  const qi = h.ls.getQuickInfoAtPosition(h.virtualFileName, g);
  return qi ? ts.displayPartsToString(qi.displayParts) : null;
}

/** The set of completion-entry names offered at a `.nota` offset (empty if the gate is closed). */
export function completionsAt(
  h: FeatureHarness,
  notaOffset: number
): Set<string> {
  // Completion is gated by `completion`; a closed gate means no request is issued → no entries.
  const g = h.gen(notaOffset, d => d.completion);
  if (g === null) {
    return new Set();
  }
  const info = h.ls.getCompletionsAtPosition(h.virtualFileName, g, {});
  return new Set((info?.entries ?? []).map(e => e.name));
}

/**
 * Go-to-definition from a `.nota` offset, each target mapped back to its `.nota` offset (targets that
 * land outside any mapping — e.g. into `lib.d.ts` — are dropped). Navigation-gated.
 */
export function definitionsAt(h: FeatureHarness, notaOffset: number): number[] {
  const g = h.gen(notaOffset, d => d.navigation);
  if (g === null) {
    return [];
  }
  const defs = h.ls.getDefinitionAtPosition(h.virtualFileName, g) ?? [];
  return defs
    .map(d => h.src(d.textSpan.start))
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
}

/** Find-references from a `.nota` offset, mapped back to `.nota` offsets (sorted, de-duped). */
export function referencesAt(h: FeatureHarness, notaOffset: number): number[] {
  const g = h.gen(notaOffset, d => d.navigation);
  if (g === null) {
    return [];
  }
  const refs = h.ls.getReferencesAtPosition(h.virtualFileName, g) ?? [];
  return dedupeSorted(
    refs
      .map(r => h.src(r.textSpan.start))
      .filter((x): x is number => x !== null)
  );
}

/** Rename locations from a `.nota` offset, mapped back to `.nota` offsets (sorted, de-duped). */
export function renameSitesAt(h: FeatureHarness, notaOffset: number): number[] {
  const g = h.gen(notaOffset, d => d.navigation);
  if (g === null) {
    return [];
  }
  const locs =
    h.ls.findRenameLocations(h.virtualFileName, g, false, false, {}) ?? [];
  return dedupeSorted(
    locs
      .map(r => h.src(r.textSpan.start))
      .filter((x): x is number => x !== null)
  );
}

function dedupeSorted(xs: number[]): number[] {
  return [...new Set(xs)].sort((a, b) => a - b);
}
