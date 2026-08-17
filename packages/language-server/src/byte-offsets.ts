/**
 * **UTF-8 byte offset → UTF-16 conversion** — the one shared implementation for every place in this
 * package that receives the reader's byte offsets (`highlightSpans`, `CodeMapping.sourceOffsets`/
 * `generatedOffsets`, `NotaError` spans) and must hand them to something that indexes a JS string in
 * UTF-16 code units: LSP `Position`s, and Volar `Mapping`s (`@volar/language-core`'s
 * `sourceOffsets`/`generatedOffsets` are plain offsets into a JS string, i.e. also UTF-16). The
 * reader is byte-native throughout (`oxc` operates on `&str`/UTF-8); every consumer downstream of it
 * in this package is UTF-16-native (`string.length`, `String.prototype.slice`, LSP positions), so
 * this boundary conversion has to happen *somewhere* — this is the one place, instead of three
 * independent hand-rolled walks (the historical bug: semantic-tokens converted, the Volar mapping
 * boundary and diagnostics did not, so any multibyte character — an em-dash, an accented word —
 * before a mapped/reported position desynced it).
 *
 * ASCII text makes UTF-8 byte offsets and UTF-16 offsets numerically identical, so every method here
 * is the identity function on ASCII input: existing ASCII fixtures are unaffected; only multibyte
 * text (where the two offset spaces diverge) changes behavior.
 *
 * One left-to-right walk over `text` by Unicode code point builds a checkpoint at each code-point
 * boundary (byte offset, UTF-16 offset, line, character); a query binary-searches the nearest
 * checkpoint at/below the target byte offset and interpolates the (single-code-unit, ASCII)
 * remainder — valid because a queried offset is always a token boundary, never mid-code-point.
 */

/** A UTF-8-byte-offset → UTF-16 converter for one fixed text, built once and queried many times. */
export interface ByteConverter {
  /** The UTF-16 code-unit offset into the text for UTF-8 byte offset `byte` (nearest boundary ≤ `byte`). */
  toUtf16(byte: number): number;
  /** The LSP `(line, character)` position (0-based, UTF-16 code units) for UTF-8 byte offset `byte`. */
  toPosition(byte: number): { line: number; character: number };
}

interface Checkpoint {
  byte: number;
  utf16: number;
  line: number;
  character: number;
}

/** Build a {@link ByteConverter} for `text` (one checkpoint pass over it, reused across queries). */
export function makeByteConverter(text: string): ByteConverter {
  const checkpoints: Checkpoint[] = [];
  let byte = 0;
  let line = 0;
  let character = 0;
  for (let i = 0; i < text.length; ) {
    checkpoints.push({ byte, utf16: i, line, character });
    const cp = text.codePointAt(i) ?? 0;
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
  checkpoints.push({ byte, utf16: text.length, line, character });

  // Binary search for the greatest checkpoint whose byte offset is ≤ target.
  function checkpointAt(target: number): Checkpoint {
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
    return checkpoints[lo];
  }

  return {
    toUtf16(target) {
      const c = checkpointAt(target);
      return c.utf16 + (target - c.byte);
    },
    toPosition(target) {
      const c = checkpointAt(target);
      const delta = target - c.byte;
      return { line: c.line, character: c.character + delta };
    }
  };
}
