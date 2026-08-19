/** Convert the reader's UTF-8 byte offsets to JS/LSP UTF-16 offsets. */

export interface ByteConverter {
  toUtf16(byte: number): number;
  toPosition(byte: number): { line: number; character: number };
}

interface Checkpoint {
  byte: number;
  utf16: number;
  line: number;
  character: number;
}

/** Build a converter for one source string. */
export function makeByteConverter(text: string): ByteConverter {
  const checkpoints: Checkpoint[] = [
    { byte: 0, utf16: 0, line: 0, character: 0 }
  ];
  let byte = 0;
  let line = 0;
  let character = 0;
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i) ?? 0;
    const utf16 = cp > 0xffff ? 2 : 1;
    const utf8 = cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
    if (cp === 10) {
      line++;
      character = 0;
    } else {
      character += utf16;
    }
    byte += utf8;
    i += utf16;
    // Plain ASCII advances equally in both offset spaces.
    if (cp === 10 || utf8 !== utf16) {
      checkpoints.push({ byte, utf16: i, line, character });
    }
  }
  if (checkpoints[checkpoints.length - 1].byte !== byte) {
    checkpoints.push({ byte, utf16: text.length, line, character });
  }

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
