/**
 * Unit coverage for the playground's LSP glue. The server itself is e2e-tested in
 * `@nota-lang/language-server` (`tests/browser-server.test.ts`, over a real MessageChannel);
 * these tests cover the two playground-side risks:
 *
 * 1. the string⇄structured-clone {@link workerTransport} adapter between `@codemirror/lsp-client`
 *    and the Volar browser connection;
 * 2. the `import.meta.glob` over `typescript/lib` resolving through pnpm's symlinked
 *    `node_modules` (the worker bundles the default libs as raw assets).
 */

import { expect, test } from "vitest";
import { notaLsp, workerTransport } from "../src/lsp/client";

// The same glob the worker entry uses (vitest evaluates import.meta.glob through vite).
const tsLibs = import.meta.glob<string>(
  "/node_modules/typescript/lib/lib.*.d.ts",
  { query: "?raw", import: "default", eager: true }
);

test("the typescript lib glob resolves through pnpm symlinks", () => {
  const names = Object.keys(tsLibs).map(k => k.split("/").pop());
  expect(names.length).toBeGreaterThan(20);
  expect(names).toContain("lib.es2022.d.ts");
  expect(names).toContain("lib.dom.d.ts");
  expect(tsLibs[Object.keys(tsLibs)[0]]).toContain("Microsoft Corporation");
});

test("workerTransport bridges string JSON to structured-clone messages", () => {
  const posted: unknown[] = [];
  const fake = {
    postMessage(message: unknown) {
      posted.push(message);
    },
    onmessage: null as ((event: { data: unknown }) => void) | null
  };
  const transport = workerTransport(fake as unknown as Worker);

  // Client → server: string JSON becomes a structured-clone object.
  transport.send('{"jsonrpc":"2.0","id":1,"method":"initialize"}');
  expect(posted).toEqual([{ jsonrpc: "2.0", id: 1, method: "initialize" }]);

  // Server → client: object becomes string JSON, fanned out to subscribers.
  const seen: string[] = [];
  const handler = (value: string) => seen.push(value);
  transport.subscribe(handler);
  fake.onmessage?.({ data: { jsonrpc: "2.0", id: 1, result: {} } });
  expect(seen).toEqual(['{"jsonrpc":"2.0","id":1,"result":{}}']);

  // Unsubscribe stops delivery.
  transport.unsubscribe(handler);
  fake.onmessage?.({ data: { jsonrpc: "2.0", method: "x" } });
  expect(seen).toHaveLength(1);
});

test("notaLsp degrades to an empty extension without Worker (jsdom)", () => {
  expect(typeof Worker).toBe("undefined");
  expect(notaLsp()).toEqual([]);
});
