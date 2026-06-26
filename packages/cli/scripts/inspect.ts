/**
 * `inspect.ts` — the front door of the Nota fuzzing microscope.
 *
 * Takes one `.nota` input and lays out *every* pipeline representation so a divergence from the spec
 * can be read off and localized: INPUT (whitespace made visible) → PARSER AST → [LOWERED AST] →
 * CODEGEN JS → JS VALIDITY → HTML → MANIFEST.
 *
 * Stages 1–4 come from the Rust `nota_inspect` example (spawned with `--json`); this script adds the
 * runtime stage by evaluating the emitted module through `@nota-lang/runtime` + the React adapter —
 * the same SSG path the CLI/playground use. The eval/SSG glue (`evalModule`/`runSSG`) is lifted from
 * `packages/playground/src/ssg.ts`; see its header for the "ambient prelude" rationale (strip the
 * runtime import + exports, inject the runtime surface + `useState` as free identifiers).
 *
 * The Rust binary is built under the **dev/debug** profile on purpose (release sets `panic = "abort"`,
 * which would make its per-stage `catch_unwind` panic isolation a no-op).
 *
 * Run via `tsx` (esbuild-based — it resolves the runtime dist's extensionless ESM imports, which raw
 * `node` does not), e.g. `cd packages/cli && pnpm inspect -- <args>`:
 *
 *   pnpm inspect -- --inline '@p{Hello *world*}'
 *   pnpm inspect -- path/to/doc.nota
 *   pnpm inspect -- --lower --json -        # read stdin, machine-readable output
 *   pnpm inspect -- --html --inline '@ul{@li{a} @li{b}}'
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import adapter from "@nota-lang/react";
import * as runtime from "@nota-lang/runtime";
import { render, setAdapter } from "@nota-lang/runtime";
import { useState } from "react";

// ---------------------------------------------------------------------------------------------------
// The Rust binary: stages 1–4.
// ---------------------------------------------------------------------------------------------------

/** The JSON shape `nota_inspect --json` prints (one object). Mirrors the Rust `Report`. */
interface ReaderReport {
  mode: string;
  input: string;
  ast: string | null;
  lowered: string | null;
  code: string | null;
  jsValid: boolean | null;
  jsErrors: string[];
  parseDiagnostics: string[];
  panic: { stage: string; message: string } | null;
}

/** Repo root, resolved relative to this file (`<root>/packages/cli/scripts/inspect.ts`). */
function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

/**
 * Resolve the `nota_inspect` binary: `NOTA_INSPECT_BIN` override, else the **debug** example build.
 * (Debug, not release — see the module header.)
 */
function resolveBinary(): string {
  const fromEnv = process.env.NOTA_INSPECT_BIN;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return join(repoRoot(), "oxc", "target", "debug", "examples", "nota_inspect");
}

/** Build the debug example (used by `--build`, or suggested when the binary is missing). */
function buildBinary(): void {
  execFileSync(
    "cargo",
    [
      "build",
      "-p",
      "oxc",
      "--example",
      "nota_inspect",
      "--features",
      "codegen"
    ],
    { cwd: join(repoRoot(), "oxc"), stdio: "inherit" }
  );
}

// ---------------------------------------------------------------------------------------------------
// The runtime stage (5): emitted module → HTML + manifest.
// Lifted from packages/playground/src/ssg.ts.
// ---------------------------------------------------------------------------------------------------

const RUNTIME_NAMES = [
  "h",
  "decode",
  "Fragment",
  "inlineComponent",
  "blockComponent"
] as const;

let adapterSet = false;
function ensureAdapter(): void {
  if (!adapterSet) {
    setAdapter(adapter);
    adapterSet = true;
  }
}

/**
 * Evaluate an emitted Nota module and return its exports (`{ default: Doc, …named components }`).
 * Strips any `@nota-lang/runtime` import + every `export` (a `new Function` body is a script, not a
 * module), then injects the runtime surface + `useState` as the free identifiers the emit references.
 */
function evalModule(emitted: string): Record<string, unknown> {
  let body = emitted.replace(
    /^\s*import\s+\{[^}]*\}\s+from\s+["']@nota-lang\/runtime["'];?\s*$/m,
    ""
  );

  const defMatch = body.match(
    /export\s+default\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/
  );
  const defaultName = defMatch ? defMatch[1] : null;
  const named: string[] = [];
  for (const m of body.matchAll(
    /export\s+(?:async\s+)?(?:let|const|var|function|class)\s+([A-Za-z_$][\w$]*)/g
  )) {
    named.push(m[1]);
  }

  body = body.replace(/export\s+default\s+/g, "");
  body = body.replace(
    /^(\s*)export\s+(?=(?:async\s+)?(?:let|const|var|function|class)\b)/gm,
    "$1"
  );
  body = body.replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, "");

  const entries = [
    ...(defaultName ? [`default: ${defaultName}`] : []),
    ...named
  ].join(", ");
  const runtimeArgs = RUNTIME_NAMES.map(
    n => (runtime as Record<string, unknown>)[n]
  );
  // Intentional eval: run the emitted module in a sandboxed function scope (best-effort runtime stage).
  const factory = new Function(
    ...RUNTIME_NAMES,
    "useState",
    `"use strict";\n${body}\n;return { ${entries} };`
  );
  return factory(...runtimeArgs, useState) as Record<string, unknown>;
}

/** Run the SSG step: emitted module → `{ html, manifest }`. */
function runSSG(emitted: string): {
  html: string;
  manifest: Record<string, unknown>;
} {
  ensureAdapter();
  const mod = evalModule(emitted);
  const Doc = mod.default as Parameters<typeof render>[0];
  const { html, manifest } = render(Doc) as {
    html: string;
    manifest: Record<string, unknown>;
  };
  return { html, manifest };
}

// ---------------------------------------------------------------------------------------------------
// Presentation.
// ---------------------------------------------------------------------------------------------------

function section(title: string): void {
  console.log(`\n${"─".repeat(12)} ${title}`);
}

/** Render whitespace/control chars visibly for the INPUT echo (mirrors the Rust `ws_visible`). */
function wsVisible(source: string): string {
  let out = "";
  let body = source;
  if (body.startsWith("﻿")) {
    out += "⟪BOM⟫";
    body = body.slice(1);
  }
  for (const ch of body) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === " ") out += "·";
    else if (ch === "\t") out += "␉";
    else if (ch === "\r") out += "⏎";
    else if (ch === "\n") out += "↵\n";
    else if (code < 0x20)
      out += `⟨${code.toString(16).toUpperCase().padStart(2, "0")}⟩`;
    else out += ch;
  }
  return out;
}

interface RuntimeStage {
  html: string | null;
  manifest: Record<string, unknown>;
  error: string | null;
}

/** Print the unified, sectioned report (reader stages + runtime stage). */
function printText(
  report: ReaderReport,
  rt: RuntimeStage,
  opts: { ast: boolean; lower: boolean }
): void {
  section(`INPUT (mode: ${report.mode})`);
  console.log(wsVisible(report.input));

  if (opts.ast && report.ast !== null) {
    section("PARSER AST");
    console.log(report.ast);
  }

  if (report.parseDiagnostics.length > 0) {
    section("PARSE DIAGNOSTICS");
    for (const d of report.parseDiagnostics) console.log(`  • ${d}`);
    console.log("\n(parse returned diagnostics — later stages skipped)");
  }

  if (opts.lower && report.lowered !== null) {
    section("LOWERED AST");
    console.log(report.lowered);
  }

  if (report.code !== null) {
    section("CODEGEN JS");
    console.log(report.code);
  }

  if (report.jsValid === true) {
    section("JS VALIDITY");
    console.log("✓ re-parses cleanly under stock oxc");
  } else if (report.jsValid === false) {
    section("JS VALIDITY");
    console.log("✗ emitted JS did NOT re-parse under stock oxc:");
    for (const e of report.jsErrors) console.log(`  • ${e}`);
  }

  if (report.panic !== null) {
    section("‼ PANIC");
    console.log(
      `stage \`${report.panic.stage}\` panicked:\n${report.panic.message}\n\n(subsequent stages skipped)`
    );
  }

  // Runtime stage — only attempted when codegen produced valid JS.
  if (report.code !== null && report.jsValid === true) {
    if (rt.error !== null) {
      section("⚠ RUNTIME ERROR");
      console.log(rt.error);
    } else {
      section("HTML");
      console.log(rt.html);
      section("MANIFEST");
      const keys = Object.keys(rt.manifest);
      console.log(
        keys.length > 0
          ? JSON.stringify(rt.manifest, null, 2)
          : "{}  (no islands)"
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------------------------------

const USAGE =
  "usage: inspect [--lower] [--expr] [--no-ast] [--html] [--json] [--build] " +
  "(--inline <src> | <file.nota> | -)";

function main(): void {
  let expr = false;
  let lower = false;
  let noAst = false;
  let htmlOnly = false;
  let jsonOut = false;
  let build = false;
  let inline: string | null = null;
  let path: string | null = null;

  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--expr") expr = true;
    else if (a === "--lower") lower = true;
    else if (a === "--no-ast") noAst = true;
    else if (a === "--html") htmlOnly = true;
    else if (a === "--json") jsonOut = true;
    else if (a === "--build") build = true;
    else if (a === "--inline") inline = argv[++i] ?? "";
    else if (a === "-h" || a === "--help") {
      console.log(USAGE);
      return;
    } else path = a;
  }

  // Locate (and, with --build or if missing+requested, build) the Rust binary.
  const bin = resolveBinary();
  if (!existsSync(bin)) {
    if (build) {
      buildBinary();
    } else {
      console.error(
        `nota_inspect not built at ${bin}\n` +
          "Build it:\n  cd oxc && cargo build -p oxc --example nota_inspect --features codegen\n" +
          "(or re-run with --build)"
      );
      process.exit(1);
    }
  } else if (build) {
    buildBinary();
  }

  // Assemble the reader-binary args. We always request --json (the structured form we re-render).
  const binArgs = ["--json"];
  if (expr) binArgs.push("--expr");
  if (inline !== null) {
    binArgs.push("--inline", inline);
  } else if (path === "-") {
    binArgs.push("--inline", readFileSync(0, "utf8")); // forward stdin as inline source
  } else if (path !== null) {
    binArgs.push(path);
  } else {
    console.error(USAGE);
    process.exit(2);
  }

  let raw: string;
  try {
    raw = execFileSync(bin, binArgs, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (err) {
    // Non-zero exit / hard crash from the binary (a usage error, or an *uncatchable* abort).
    console.error(
      `nota_inspect failed: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
  const report = JSON.parse(raw) as ReaderReport;

  // Runtime stage — only when codegen produced valid JS.
  const rt: RuntimeStage = { html: null, manifest: {}, error: null };
  if (report.code !== null && report.jsValid === true) {
    try {
      const r = runSSG(report.code);
      rt.html = r.html;
      rt.manifest = r.manifest;
    } catch (err) {
      rt.error = err instanceof Error ? `${err.message}` : String(err);
    }
  }

  if (jsonOut) {
    console.log(
      JSON.stringify(
        {
          ...report,
          html: rt.html,
          manifest: rt.manifest,
          runtimeError: rt.error
        },
        null,
        2
      )
    );
    return;
  }

  if (htmlOnly) {
    if (rt.error !== null) console.error(`runtime error: ${rt.error}`);
    else console.log(rt.html ?? "");
    return;
  }

  printText(report, rt, { ast: !noAst, lower });
}

main();
