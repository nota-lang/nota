/**
 * A minimal JSON-RPC-over-stdio LSP client for the heap-capped end-to-end server tests
 * (`server-smoke.test.ts`, `server-e2e.test.ts`). Boots nothing itself — it wraps a spawned
 * `dist/bin.js --stdio` child: frames requests/notifications, resolves responses by id, answers the
 * server→client requests politely (`workspace/configuration` needs an *array* of results, everything
 * else a `null`), and records every `textDocument/publishDiagnostics` push for the diagnostics test.
 *
 * The `_` prefix keeps this file out of the `*.test.*` glob — it is a helper, not a suite.
 */

import type { spawn } from "node:child_process";

// biome-ignore lint/suspicious/noExplicitAny: an untyped JSON-RPC envelope is intentional here.
type RpcMessage = any;

/** A `textDocument/publishDiagnostics` payload the server pushed. */
export interface DiagnosticsPush {
  uri: string;
  version?: number;
  diagnostics: {
    message: string;
    source?: string;
    severity?: number;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }[];
}

export interface LspClient {
  request(method: string, params: unknown): Promise<RpcMessage>;
  notify(method: string, params: unknown): void;
  /** Every diagnostics push the server has sent so far, in arrival order. */
  readonly publishes: DiagnosticsPush[];
}

/** Wrap a spawned language-server child in a promise-based JSON-RPC client. */
export function createLspClient(child: ReturnType<typeof spawn>): LspClient {
  let nextId = 1;
  const pending = new Map<number, (msg: RpcMessage) => void>();
  const publishes: DiagnosticsPush[] = [];
  let buf = Buffer.alloc(0);

  function send(msg: unknown) {
    const body = JSON.stringify(msg);
    child.stdin!.write(
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
    );
  }

  child.stdout!.on("data", chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const m = /Content-Length: (\d+)/.exec(
        buf.subarray(0, headerEnd).toString()
      );
      if (!m) return;
      const len = Number(m[1]);
      if (buf.length < headerEnd + 4 + len) return;
      const msg = JSON.parse(
        buf.subarray(headerEnd + 4, headerEnd + 4 + len).toString()
      );
      buf = buf.subarray(headerEnd + 4 + len);

      if (msg.method === "textDocument/publishDiagnostics") {
        publishes.push(msg.params);
      }
      if (msg.id !== undefined && msg.method) {
        // server → client request: `workspace/configuration` wants one result per item; else `null`.
        const result =
          msg.method === "workspace/configuration"
            ? msg.params.items.map(() => null)
            : null;
        send({ jsonrpc: "2.0", id: msg.id, result });
      } else if (msg.id !== undefined && pending.has(msg.id)) {
        const res = pending.get(msg.id)!;
        pending.delete(msg.id);
        res(msg);
      }
    }
  });

  return {
    publishes,
    request(method, params) {
      const id = nextId++;
      send({ jsonrpc: "2.0", id, method, params });
      return new Promise(res => pending.set(id, res));
    },
    notify(method, params) {
      send({ jsonrpc: "2.0", method, params });
    }
  };
}
