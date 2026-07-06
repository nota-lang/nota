/**
 * **End-to-end LSP feature tests through the real server connection** (contract-bug regression).
 *
 * These boot the real Nota Volar server the way `vscode-languageclient` does (`node dist/bin.js
 * --stdio`, heap-capped so a runaway project load dies fast instead of OOM'ing), do the LSP handshake
 * ONCE, and then exercise the three source-document features that Volar's service-plugin channel
 * silently could not route — semantic tokens, `@|` completion, and Nota syntax diagnostics — over the
 * wire. Direct plugin-function calls (the other suites) is exactly what let those three ship dead in
 * production; these assert the behaviour a real editor sees.
 *
 * One server is shared across the tests (a boot is ~seconds); each test opens its own uniquely-named
 * document so they do not interfere.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createLspClient, type LspClient } from "./_lsp-client";

const BIN = resolve(import.meta.dirname, "..", "dist", "bin.js");
const HEAP_MB = 768;

/** A decoded semantic token: its `(line, character)`, length, legend type name, and source text. */
interface DecodedToken {
  line: number;
  char: number;
  length: number;
  type: string;
  text: string;
}

/** Decode an LSP relative `SemanticTokens.data` stream against `legend` + the document `text`. */
function decodeTokens(
  data: number[],
  legend: { tokenTypes: string[] },
  text: string
): DecodedToken[] {
  const lines = text.split("\n");
  const out: DecodedToken[] = [];
  let line = 0;
  let char = 0;
  for (let i = 0; i < data.length; i += 5) {
    const [dl, dc, length, type] = data.slice(i, i + 5);
    line += dl;
    char = dl === 0 ? char + dc : dc;
    out.push({
      line,
      char,
      length,
      type: legend.tokenTypes[type] ?? String(type),
      text: lines[line]?.slice(char, char + length) ?? ""
    });
  }
  return out;
}

/** Poll `cond` until it returns truthy or `timeoutMs` elapses (for the async diagnostics push). */
async function waitFor<T>(
  cond: () => T | undefined,
  timeoutMs: number
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = cond();
    if (v) return v;
    if (Date.now() > deadline) return undefined;
    await new Promise(r => setTimeout(r, 50));
  }
}

describe("language server end-to-end (real boot, heap-capped)", () => {
  let child: ReturnType<typeof spawn>;
  let c: LspClient;
  let dir: string;
  let legend: { tokenTypes: string[]; tokenModifiers: string[] };
  let exited: { code: number | null; signal: string | null } | null = null;

  function openDoc(name: string, text: string): string {
    const path = join(dir, name);
    writeFileSync(path, text, "utf8");
    const uri = `file://${path}`;
    c.notify("textDocument/didOpen", {
      textDocument: { uri, languageId: "nota", version: 1, text }
    });
    return uri;
  }

  beforeAll(async () => {
    expect(
      existsSync(BIN),
      `built server missing at ${BIN} (run depot build)`
    ).toBe(true);
    dir = mkdtempSync(join(tmpdir(), "nota-e2e-"));
    child = spawn("node", [`--max-old-space-size=${HEAP_MB}`, BIN, "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    child.on("exit", (code, signal) => {
      exited = { code, signal };
    });
    c = createLspClient(child);
    const init = await c.request("initialize", {
      processId: process.pid,
      rootUri: `file://${dir}`,
      workspaceFolders: [{ uri: `file://${dir}`, name: "nota" }],
      capabilities: {
        workspace: { configuration: true },
        textDocument: {
          completion: { completionItem: { snippetSupport: true } },
          publishDiagnostics: {},
          semanticTokens: {
            requests: { full: true },
            tokenTypes: [],
            tokenModifiers: [],
            formats: ["relative"]
          }
        }
      }
    });
    legend = init.result?.capabilities?.semanticTokensProvider?.legend;
    expect(
      legend?.tokenTypes,
      "server advertised a semantic-tokens legend"
    ).toBeTruthy();
    c.notify("initialized", {});
  }, 60_000);

  afterAll(() => child?.kill("SIGKILL"));

  test("semanticTokens/full carries reader Nota kinds and `=>` as one operator token", async () => {
    // A `%` statement with a JS arrow, a heading, and a markup element + interpolation.
    const text = '%let f = () => "x"\n\n# Head\n\n@div{@f}\n';
    const uri = openDoc("sem.nota", text);
    const resp = await c.request("textDocument/semanticTokens/full", {
      textDocument: { uri }
    });
    const toks = decodeTokens(resp.result?.data ?? [], legend, text);

    // Reader-driven Nota kinds are present (the bug: only TS-mapped identifier kinds came back).
    const notaTypes = new Set(
      toks.filter(t => t.type.startsWith("nota")).map(t => t.type)
    );
    expect([...notaTypes], JSON.stringify(toks)).toEqual(
      expect.arrayContaining(["notaSigil"])
    );
    expect(toks.some(t => t.type === "notaTag" && t.text === "div")).toBe(true);
    expect(toks.some(t => t.type === "notaHeadingMarker")).toBe(true);

    // The JS arrow is exactly ONE token, typed `operator`, over the whole `=>` (the user-visible
    // "mixed/wrong arrow colours" symptom was this token being TS-mapped or split).
    const arrows = toks.filter(t => t.text === "=>");
    expect(arrows.length, JSON.stringify(toks)).toBe(1);
    expect(arrows[0].type).toBe("operator");
    expect(arrows[0].length).toBe(2);

    expect(exited, "server crashed/OOM'd").toBeNull();
  }, 30_000);

  test("completion at a bare `@|` head returns prelude slots + host tags", async () => {
    const text = "# Title\n\n@\n";
    const uri = openDoc("comp.nota", text);
    const resp = await c.request("textDocument/completion", {
      textDocument: { uri },
      position: { line: 2, character: 1 },
      context: { triggerKind: 2, triggerCharacter: "@" }
    });
    const items = resp.result?.items ?? resp.result ?? [];
    const labels: string[] = items.map((i: { label: string }) => i.label);

    // The bug: this returned ZERO items (the plugin never saw the source doc). Now non-empty…
    expect(labels.length, JSON.stringify(labels)).toBeGreaterThan(0);
    // …with the ambient prelude slots (`Tex`) and curated host tags (`div`, `p`).
    expect(labels).toContain("Tex");
    expect(labels).toContain("div");
    expect(labels).toContain("p");
  }, 30_000);

  test("a Nota syntax error surfaces as a pushed diagnostic with source `nota`", async () => {
    // An unterminated `@div{ …` body → the reader's recovered "Expected `}`" error.
    const uri = openDoc("diag.nota", "# Title\n\n@div{ hello\n");
    const push = await waitFor(
      () =>
        c.publishes
          .filter(p => p.uri === uri)
          .find(p => p.diagnostics.some(d => d.source === "nota")),
      10_000
    );
    expect(push, `no nota diagnostic pushed for ${uri}`).toBeTruthy();
    const notaDiag = push!.diagnostics.find(d => d.source === "nota")!;
    expect(notaDiag.message).toMatch(/\}/);
    expect(notaDiag.severity).toBe(1); // DiagnosticSeverity.Error
  }, 30_000);
});
