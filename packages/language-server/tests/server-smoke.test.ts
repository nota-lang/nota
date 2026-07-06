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
 * surface resolves through the generated ambient preamble (D3), so the TS project stays tiny. The
 * deep per-feature assertions (Nota kinds, `@|` completion, syntax diagnostics) live in
 * `server-e2e.test.ts`; this file just proves the server boots, advertises the right capabilities, and
 * that its semantic tokens are reader-driven (a Nota kind lands, not only TS-mapped identifiers).
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { createLspClient } from "./_lsp-client";

const BIN = resolve(import.meta.dirname, "..", "dist", "bin.js");
const HEAP_MB = 768;

describe("language server (real boot, heap-capped)", () => {
  test("boots, advertises semantic tokens + `@`/`[` triggers, and serves reader-driven tokens", async () => {
    expect(
      existsSync(BIN),
      `built server missing at ${BIN} (run depot build)`
    ).toBe(true);

    const dir = mkdtempSync(join(tmpdir(), "nota-server-"));
    const docPath = join(dir, "doc.nota");
    const text =
      "# Title\n\nA *bold* and @em{word} and `code`.\n\n% const n = 1\n";
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
      const c = createLspClient(child);
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
      // The server advertises a semantic-tokens provider (the merged legend).
      const legend = init.result?.capabilities?.semanticTokensProvider?.legend;
      expect(legend?.tokenTypes).toBeTruthy();
      // …and completion trigger characters `@` and `[` (the Nota completions plugin, P5).
      const triggers: string[] =
        init.result?.capabilities?.completionProvider?.triggerCharacters ?? [];
      expect(triggers).toContain("@");
      expect(triggers).toContain("[");

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
      // Reader-driven: at least one token is a Nota kind (index into the legend ≥ the first
      // `nota*` type). Before the source-routing fix this stream held only TS-mapped identifier
      // kinds — so this asserts the fix, not just "some tokens".
      const firstNotaType = legend.tokenTypes.findIndex((t: string) =>
        t.startsWith("nota")
      );
      expect(firstNotaType).toBeGreaterThanOrEqual(0);
      const types: number[] = [];
      for (let i = 3; i < data.length; i += 5) {
        types.push(data[i]);
      }
      expect(
        types.some(t => t >= firstNotaType),
        `no Nota-kind token in ${JSON.stringify(types)}`
      ).toBe(true);

      // The server survived (no OOM / crash) up to here.
      expect(exitInfo, "server exited early (crash/OOM?)").toBeNull();
    } finally {
      child.kill("SIGKILL");
    }
  }, 60_000);
});
