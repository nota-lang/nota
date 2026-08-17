/**
 * **`server-core.ts`'s directly-testable pieces.**
 *
 * `registerNotaConnectionFeatures` itself needs a real Volar `Connection`/`LanguageServer` (exercised
 * end-to-end in `server-e2e.test.ts` / `server-smoke.test.ts`, against the built `dist/`), but the
 * decisions it makes are pulled out as plain exports specifically so they're unit-testable without
 * that: {@link LastGoodCache} (the eviction-on-close cache) here, {@link shouldOfferHeadCompletions}
 * in `completions.test.ts` (completion-specific, kept there).
 */

import { describe, expect, test } from "vitest";
import { LastGoodCache } from "../src/server-core";

/** A minimal `CloseSource` stub: records the listener `LastGoodCache` registers so the test can fire
 *  it manually, standing in for Volar's real `documents.onDidClose` event. */
function fakeDocuments() {
  let listener: ((e: { document: { uri: string } }) => void) | null = null;
  return {
    onDidClose(l: (e: { document: { uri: string } }) => void) {
      listener = l;
    },
    close(uri: string) {
      listener?.({ document: { uri } });
    }
  };
}

describe("LastGoodCache", () => {
  test("get/set round-trip per URI", () => {
    const docs = fakeDocuments();
    const cache = new LastGoodCache<string[]>(docs);
    cache.set("file:///a.nota", ["a-tokens"]);
    cache.set("file:///b.nota", ["b-tokens"]);
    expect(cache.get("file:///a.nota")).toEqual(["a-tokens"]);
    expect(cache.get("file:///b.nota")).toEqual(["b-tokens"]);
    expect(cache.get("file:///unset.nota")).toBeUndefined();
  });

  test("evicts only the closed URI's entry when the document-close event fires", () => {
    const docs = fakeDocuments();
    const cache = new LastGoodCache<string[]>(docs);
    cache.set("file:///a.nota", ["a-tokens"]);
    cache.set("file:///b.nota", ["b-tokens"]);

    docs.close("file:///a.nota");

    expect(cache.get("file:///a.nota")).toBeUndefined();
    expect(cache.get("file:///b.nota")).toEqual(["b-tokens"]); // untouched
  });

  test("closing a URI that was never cached is a no-op (no throw)", () => {
    const docs = fakeDocuments();
    new LastGoodCache<string[]>(docs); // registers the close listener; nothing cached yet
    expect(() => docs.close("file:///never-opened.nota")).not.toThrow();
  });

  test("a value re-set after close is served again (reopen/re-highlight)", () => {
    const docs = fakeDocuments();
    const cache = new LastGoodCache<string[]>(docs);
    cache.set("file:///a.nota", ["first"]);
    docs.close("file:///a.nota");
    expect(cache.get("file:///a.nota")).toBeUndefined();
    cache.set("file:///a.nota", ["second"]);
    expect(cache.get("file:///a.nota")).toEqual(["second"]);
  });
});
