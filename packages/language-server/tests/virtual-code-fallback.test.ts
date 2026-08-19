/**
 * **Backend-failure degradation.** `createNotaVirtualCode`'s `try/catch` guards a true *backend*
 * failure — a desynced `@nota-lang/compiler` wasm build throwing from `analyze` (Nota
 * syntax errors never throw; EOF recovery handles those). The server must stay alive: the
 * virtual code degrades to an empty TS module (preamble only, zero mappings) instead of
 * propagating the throw into Volar.
 */

import ts from "typescript";
import { describe, expect, test, vi } from "vitest";
import { URI } from "vscode-uri";

vi.mock("@nota-lang/compiler", async importOriginal => {
  const actual = await importOriginal<typeof import("@nota-lang/compiler")>();
  return {
    ...actual,
    analyze: () => {
      throw new Error("simulated desynced wasm backend");
    }
  };
});

import { NOTA_LANGUAGE_ID, notaLanguagePlugin } from "../src/language-plugin";
import { PREAMBLE } from "../src/preamble";

describe("desynced wasm backend (analyze throws)", () => {
  test("createVirtualCode degrades to an empty module instead of throwing", () => {
    const snapshot = ts.ScriptSnapshot.fromString("@p{hi}\n");
    const vcode = notaLanguagePlugin.createVirtualCode?.(
      URI.parse("file:///doc.nota"),
      NOTA_LANGUAGE_ID,
      snapshot
    );
    if (!vcode) throw new Error("createVirtualCode returned undefined");
    // The degraded module is exactly the preamble (an empty document body) with no mappings —
    // TS features go quiet for this file, but the server keeps serving every other request.
    expect(vcode.snapshot.getText(0, vcode.snapshot.getLength())).toBe(
      PREAMBLE
    );
    expect(vcode.mappings).toEqual([]);
  });
});
