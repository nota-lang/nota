/**
 * E2E for the **browser worker** flavor (`src/browser.ts`), driven the way the playground drives
 * it — LSP over `postMessage` — but from node: `globalThis.MessageChannel` is the web-standard
 * API, and `BrowserMessageReader/Writer` bind to anything with `postMessage`/`onmessage`, so one
 * port plays the worker's `self` and the other plays the client.
 *
 * This proves the parts the node e2e cannot: the postMessage transport, the in-memory filesystem
 * (tsconfig + basename-served TS libs — no disk), and the full TS language service running over
 * the virtual `.tsx` without `ts.sys`-backed resolution.
 */

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { startBrowserServer } from "../src/browser";

// ---------------------------------------------------------------------------------------------------
// Harness: a promise-based JSON-RPC client over one end of a MessageChannel.

const require = createRequire(import.meta.url);

/** The full TypeScript default-lib set, exactly as the playground bundles it. */
function tsLibs(): Record<string, string> {
  const libDir = dirname(require.resolve("typescript"));
  const libs: Record<string, string> = {};
  for (const name of readdirSync(libDir)) {
    if (name.startsWith("lib.") && name.endsWith(".d.ts")) {
      libs[name] = readFileSync(join(libDir, name), "utf8");
    }
  }
  return libs;
}

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

const channel = new MessageChannel();
const serverPort = channel.port1;
const clientPort = channel.port2;

const received: JsonRpcMessage[] = [];
clientPort.onmessage = event => {
  received.push(event.data as JsonRpcMessage);
};

let nextId = 1;
function notify(method: string, params: unknown): void {
  clientPort.postMessage({ jsonrpc: "2.0", method, params });
}
async function request(method: string, params: unknown): Promise<unknown> {
  const id = nextId++;
  clientPort.postMessage({ jsonrpc: "2.0", id, method, params });
  const response = await waitFor(
    m => m.id === id && ("result" in m || "error" in m),
    `response to ${method}`
  );
  if (response.error) {
    throw new Error(`${method}: ${response.error.message}`);
  }
  return response.result;
}
async function waitFor(
  predicate: (m: JsonRpcMessage) => boolean,
  what: string,
  ms = 30_000
): Promise<JsonRpcMessage> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const i = received.findIndex(predicate);
    if (i >= 0) {
      return received.splice(i, 1)[0];
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`timeout waiting for ${what}`);
}

afterAll(() => {
  serverPort.close();
  clientPort.close();
});

// ---------------------------------------------------------------------------------------------------

const DOC_URI = "file:///workspace/doc.nota";
const DOC_TEXT = [
  '%let bad: number = "str";',
  "%let Note = (props: { children?: unknown }) => @aside{@(props.children)}",
  "@Note{Hello @em{world}}",
  ""
].join("\n");

test("browser server: initialize + didOpen over postMessage", async () => {
  // The worker global: the server binds BrowserMessageReader/Writer to `self`.
  (globalThis as { self?: unknown }).self = serverPort;
  startBrowserServer({ tsLibs: tsLibs() });

  const init = (await request("initialize", {
    processId: null,
    rootUri: "file:///workspace",
    workspaceFolders: [{ uri: "file:///workspace", name: "workspace" }],
    capabilities: {
      textDocument: {
        publishDiagnostics: {},
        hover: {},
        semanticTokens: {
          requests: { full: true },
          tokenTypes: [],
          tokenModifiers: [],
          formats: ["relative"]
        }
      }
    }
  })) as { capabilities: Record<string, unknown> };
  expect(init.capabilities.hoverProvider).toBeTruthy();
  expect(init.capabilities.semanticTokensProvider).toBeTruthy();
  notify("initialized", {});
  notify("textDocument/didOpen", {
    textDocument: {
      uri: DOC_URI,
      languageId: "nota",
      version: 1,
      text: DOC_TEXT
    }
  });
});

test("TS diagnostics flow over the in-memory filesystem, mapped to .nota", async () => {
  const push = await waitFor(
    m =>
      m.method === "textDocument/publishDiagnostics" &&
      (m.params as { diagnostics: { message: string }[] }).diagnostics.some(d =>
        d.message.includes("not assignable")
      ),
    "TS diagnostic push"
  );
  const { diagnostics } = push.params as {
    diagnostics: {
      message: string;
      source?: string;
      range: { start: { line: number; character: number } };
    }[];
  };
  const bad = diagnostics.find(d => d.message.includes("not assignable"));
  expect(bad?.source).toBe("ts");
  // `%let bad` — line 0, `bad` starts after "%let " (the mapped .nota position).
  expect(bad?.range.start).toEqual({ line: 0, character: 5 });
  // No global-type noise: the basename-served libs resolved (console, string, …).
  expect(
    diagnostics.filter(d => d.message.includes("Cannot find global type"))
  ).toEqual([]);
});

test("hover answers through the virtual .tsx", async () => {
  const hover = (await request("textDocument/hover", {
    textDocument: { uri: DOC_URI },
    position: { line: 1, character: 6 } // inside `Note`
  })) as { contents: { value: string } } | null;
  expect(hover?.contents.value).toContain("(props:");
});

test("reader-driven semantic tokens serve over postMessage", async () => {
  const tokens = (await request("textDocument/semanticTokens/full", {
    textDocument: { uri: DOC_URI }
  })) as { data: number[] };
  expect(tokens.data.length).toBeGreaterThan(0);
  expect(tokens.data.length % 5).toBe(0);
});
