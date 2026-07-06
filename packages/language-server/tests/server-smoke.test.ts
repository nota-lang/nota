/**
 * **Heap-capped server smoke test.**
 *
 * Boots the real Nota Volar server the way `vscode-languageclient` does (`node dist/bin.js
 * --stdio`), performs the LSP handshake, opens a `.nota`, and requests reader-driven semantic tokens
 * — end-to-end, over the running server (not the direct-TS harness the feature tests use). The heap
 * is **capped** (`--max-old-space-size`) so a runaway project load (this repo once OOM'd at 4 GB
 * from a too-broad root `tsconfig`) dies fast and fails the test instead of eating the machine.
 *
 * The project is rooted in a scratch dir with a single `.nota` and no `node_modules` — the typed
 * surface resolves through the generated ambient preamble (D3), so the TS project stays tiny.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const BIN = resolve(import.meta.dirname, "..", "dist", "bin.js");
const HEAP_MB = 768;

/** A minimal JSON-RPC-over-stdio client for one server child. */
function client(child: ReturnType<typeof spawn>) {
  let nextId = 1;
  const pending = new Map<number, (msg: any) => void>();
  let buf = Buffer.alloc(0);

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
      if (msg.id !== undefined && msg.method) {
        // server → client request: answer politely so the server keeps moving.
        send({ jsonrpc: "2.0", id: msg.id, result: null });
      } else if (msg.id !== undefined && pending.has(msg.id)) {
        const res = pending.get(msg.id)!;
        pending.delete(msg.id);
        res(msg);
      }
    }
  });

  function send(msg: unknown) {
    const body = JSON.stringify(msg);
    child.stdin!.write(
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
    );
  }
  function request(method: string, params: unknown): Promise<any> {
    const id = nextId++;
    send({ jsonrpc: "2.0", id, method, params });
    return new Promise(res => pending.set(id, res));
  }
  const notify = (method: string, params: unknown) =>
    send({ jsonrpc: "2.0", method, params });
  return { request, notify };
}

describe("language server (real boot, heap-capped)", () => {
  test(
    "boots, advertises semantic tokens, and serves reader-driven tokens without OOM",
    async () => {
      expect(existsSync(BIN), `built server missing at ${BIN} (run depot build)`).toBe(true);

      const dir = mkdtempSync(join(tmpdir(), "nota-server-"));
      const docPath = join(dir, "doc.nota");
      const text = "# Title\n\nA *bold* and @em{word} and `code`.\n\n% const n = 1\n";
      writeFileSync(docPath, text, "utf8");
      const uri = `file://${docPath}`;

      const child = spawn(
        "node",
        [`--max-old-space-size=${HEAP_MB}`, BIN, "--stdio"],
        { stdio: ["pipe", "pipe", "pipe"] }
      );
      let exitInfo: { code: number | null; signal: string | null } | null = null;
      child.on("exit", (code, signal) => {
        exitInfo = { code, signal };
      });

      try {
        const c = client(child);
        const init = await c.request("initialize", {
          processId: process.pid,
          rootUri: `file://${dir}`,
          workspaceFolders: [{ uri: `file://${dir}`, name: "nota" }],
          capabilities: {
            textDocument: {
              semanticTokens: {
                requests: { full: true },
                tokenTypes: [],
                tokenModifiers: [],
                formats: ["relative"]
              }
            }
          }
        });
        // The server advertises a semantic-tokens provider (the Nota plugin's legend).
        expect(init.result?.capabilities?.semanticTokensProvider).toBeTruthy();

        c.notify("initialized", {});
        c.notify("textDocument/didOpen", {
          textDocument: { uri, languageId: "nota", version: 1, text }
        });

        const tokens = await c.request("textDocument/semanticTokens/full", {
          textDocument: { uri }
        });
        const data: number[] = tokens.result?.data ?? [];
        // A non-empty 5-tuple stream (heading marker, emphasis, tag, embedded-JS keyword, …).
        expect(data.length).toBeGreaterThan(0);
        expect(data.length % 5).toBe(0);

        // The server survived (no OOM / crash) up to here.
        expect(exitInfo, "server exited early (crash/OOM?)").toBeNull();
      } finally {
        child.kill("SIGKILL");
      }
    },
    60_000
  );
});
