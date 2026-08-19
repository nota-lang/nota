/** Build Volar's virtual TSX document and mappings for a Nota source. */

import {
  analyze,
  type NotaError,
  type CodeMapping as ReaderCodeMapping
} from "@nota-lang/compiler";
import type {
  LanguagePlugin,
  VirtualCode,
  CodeMapping as VolarCodeMapping
} from "@volar/language-core";
import type { TypeScriptServiceScript } from "@volar/typescript";
import ts from "typescript";
import type { URI } from "vscode-uri";
import { makeByteConverter } from "./byte-offsets.js";
import { PREAMBLE, PREAMBLE_LENGTH } from "./preamble.js";

export const NOTA_LANGUAGE_ID = "nota";

export const VIRTUAL_LANGUAGE_ID = "typescriptreact";

/**
 * Adapt reader mappings to Volar and account for the prepended preamble.
 * Offsets are still UTF-8 bytes here; {@link mappingsToUtf16} performs the boundary conversion.
 */
export function shiftMappings(
  mappings: readonly ReaderCodeMapping[],
  shift: number
): VolarCodeMapping[] {
  return mappings.map(m => ({
    sourceOffsets: m.sourceOffsets.slice(),
    generatedOffsets: m.generatedOffsets.map(o => o + shift),
    lengths: m.lengths.slice(),
    ...(m.generatedLengths != null
      ? { generatedLengths: m.generatedLengths.slice() }
      : {}),
    data: m.data
  }));
}

// Map the cursor after `x.` and `x?.` so TypeScript can offer member completions.
const EXTEND_BYTES = new Set([".".codePointAt(0), "?".codePointAt(0)]);

/**
 * Extend byte-exact mappings across identical member-access punctuation.
 * Zero-width anchors are left unchanged.
 */
export function extendMappings(
  source: string,
  bare: string,
  mappings: readonly ReaderCodeMapping[]
): ReaderCodeMapping[] {
  const src = new TextEncoder().encode(source);
  const gen = new TextEncoder().encode(bare);
  return mappings.map(m => {
    if (m.generatedLengths != null) {
      return m;
    }
    const lengths = m.lengths.slice();
    for (let i = 0; i < m.sourceOffsets.length; i++) {
      const cap =
        i + 1 < m.sourceOffsets.length ? m.sourceOffsets[i + 1] : src.length;
      let s = m.sourceOffsets[i] + lengths[i];
      let g = m.generatedOffsets[i] + lengths[i];
      while (
        s < cap &&
        g < gen.length &&
        src[s] === gen[g] &&
        EXTEND_BYTES.has(src[s])
      ) {
        lengths[i]++;
        s++;
        g++;
      }
    }
    return { ...m, lengths };
  });
}

/** Convert reader byte offsets and lengths to the UTF-16 units Volar indexes. */
export function mappingsToUtf16(
  source: string,
  code: string,
  mappings: readonly VolarCodeMapping[]
): VolarCodeMapping[] {
  const src = makeByteConverter(source);
  const gen = makeByteConverter(code);
  return mappings.map(m => {
    const sourceOffsets: number[] = [];
    const generatedOffsets: number[] = [];
    const lengths: number[] = [];
    const generatedLengths: number[] = [];
    let generatedDiffers = false;
    for (let k = 0; k < m.sourceOffsets.length; k++) {
      const soByte = m.sourceOffsets[k];
      const sLenByte = m.lengths[k];
      const goByte = m.generatedOffsets[k];
      const gLenByte = m.generatedLengths?.[k] ?? sLenByte;

      const so = src.toUtf16(soByte);
      const go = gen.toUtf16(goByte);
      const sLen = src.toUtf16(soByte + sLenByte) - so;
      const gLen = gen.toUtf16(goByte + gLenByte) - go;

      sourceOffsets.push(so);
      generatedOffsets.push(go);
      lengths.push(sLen);
      generatedLengths.push(gLen);
      if (gLen !== sLen) {
        generatedDiffers = true;
      }
    }
    return {
      sourceOffsets,
      generatedOffsets,
      lengths,
      ...(m.generatedLengths != null || generatedDiffers
        ? { generatedLengths }
        : {}),
      data: m.data
    };
  });
}

/** Compile a Nota source to preamble-prefixed TSX and UTF-16 Volar mappings. */
export function buildVirtual(source: string): {
  code: string;
  mappings: VolarCodeMapping[];
  errors: NotaError[];
} {
  const { code: bare, mappings, errors } = analyze(source);
  const code = PREAMBLE + bare;
  const byteMappings = shiftMappings(
    extendMappings(source, bare, mappings),
    PREAMBLE_LENGTH
  );
  return {
    code,
    mappings: mappingsToUtf16(source, code, byteMappings),
    errors
  };
}

export interface NotaVirtualCode extends VirtualCode {
  id: "root";
  languageId: typeof VIRTUAL_LANGUAGE_ID;
}

/** Create a recoverable virtual document; backend failures degrade to the preamble alone. */
function createNotaVirtualCode(snapshot: ts.IScriptSnapshot): NotaVirtualCode {
  const source = snapshot.getText(0, snapshot.getLength());
  let code: string;
  let mappings: VolarCodeMapping[];
  try {
    ({ code, mappings } = buildVirtual(source));
  } catch {
    code = PREAMBLE;
    mappings = [];
  }
  return {
    id: "root",
    languageId: VIRTUAL_LANGUAGE_ID,
    snapshot: ts.ScriptSnapshot.fromString(code),
    mappings
  };
}

function getServiceScript(
  root: VirtualCode
): TypeScriptServiceScript | undefined {
  if (root.id !== "root") {
    return undefined;
  }
  return {
    code: root,
    extension: ".tsx",
    scriptKind: ts.ScriptKind.TSX
  };
}

export const notaLanguagePlugin: LanguagePlugin<URI, NotaVirtualCode> = {
  getLanguageId(uri) {
    if (uri.path.endsWith(".nota")) {
      return NOTA_LANGUAGE_ID;
    }
    return undefined;
  },

  createVirtualCode(_uri, languageId, snapshot) {
    if (languageId !== NOTA_LANGUAGE_ID) {
      return undefined;
    }
    return createNotaVirtualCode(snapshot);
  },

  updateVirtualCode(_uri, _virtualCode, newSnapshot) {
    return createNotaVirtualCode(newSnapshot);
  },

  typescript: {
    extraFileExtensions: [
      {
        extension: "nota",
        isMixedContent: true,
        scriptKind: ts.ScriptKind.Deferred
      }
    ],
    getServiceScript
  }
};
