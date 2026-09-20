/**
 * **Ambient-signature drift alarm.** The typing preamble's declarations (preamble-gen.ts) are
 * hand-written, deliberately permissive views of real types — solid-js's state surface and the
 * prelude's components. Their *names* are coverage-guarded (preamble-sync); their *shapes* had
 * no guard at all. This test renders the REAL types through the TS checker into a snapshot:
 * when an upstream signature changes (a solid-js bump, a prelude prop change), the snapshot
 * churns and fails, prompting a review of the corresponding hand-written declaration. The
 * declarations stay policy; the alarm is generated.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AMBIENT_PRELUDE_NAMES,
  SOLID_AMBIENT_NAMES,
  SOLID_WEB_MODULE,
  SOLID_WEB_NAMES
} from "@nota-lang/compiler";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROBE_PATH = join(PKG_ROOT, "__ambient_probe__.ts");

/** Render `typeof import(module).name` for each name via a real-fs TS program rooted here. */
function realSignatures(
  module: string,
  names: readonly string[]
): Record<string, string> {
  const probe = names
    .map(n => `export declare const ${n}: typeof import("${module}").${n};`)
    .join("\n");

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: []
  };
  const host = ts.createCompilerHost(options, true);
  const baseGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, ...rest) =>
    fileName === PROBE_PATH
      ? ts.createSourceFile(fileName, probe, languageVersion, true)
      : baseGetSourceFile(fileName, languageVersion, ...rest);
  const baseFileExists = host.fileExists.bind(host);
  host.fileExists = fileName =>
    fileName === PROBE_PATH || baseFileExists(fileName);
  const baseReadFile = host.readFile.bind(host);
  host.readFile = fileName =>
    fileName === PROBE_PATH ? probe : baseReadFile(fileName);
  host.getCurrentDirectory = () => PKG_ROOT;

  const program = ts.createProgram([PROBE_PATH], options, host);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(PROBE_PATH);
  if (!source) throw new Error("probe source missing");

  const out: Record<string, string> = {};
  for (const stmt of source.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const decl = stmt.declarationList.declarations[0];
    const name = decl.name.getText(source);
    const type = checker.getTypeAtLocation(decl);
    out[name] = normalizeModulePaths(
      checker.typeToString(type, decl, ts.TypeFormatFlags.NoTruncation)
    );
  }
  return out;
}

/**
 * Collapse `import("…/node_modules/…/pkg/dist/types/x")` down to `import("pkg")`.
 *
 * TS prints a *path* rather than a bare specifier whenever the declaring package is not
 * resolvable from this package's own `node_modules` — under pnpm's strict layout that is every
 * transitive dependency. Solid 2 made that load-bearing: `onCleanup` is re-exported from
 * `@solidjs/signals`, which `language-server` does not depend on directly, so its signature
 * renders with the virtual store's directory name (`.pnpm/@solidjs+signals@2.0.0-rc.8/…`) baked
 * in — an installer- and version-shaped string in a snapshot whose subject is the *signature*.
 */
function normalizeModulePaths(sig: string): string {
  return sig.replace(
    /"[^"]*node_modules\/(?:\.pnpm\/[^/"]+\/node_modules\/)?((?:@[^/"]+\/)?[^/"]+)[^"]*"/g,
    '"$1"'
  );
}

const render = (sigs: Record<string, string>): string =>
  Object.entries(sigs)
    .map(([name, sig]) => `${name}: ${sig}`)
    .join("\n");

describe("real upstream signatures (change → review the preamble declaration)", () => {
  test("solid-js ambient surface", () => {
    const sigs = realSignatures("solid-js", SOLID_AMBIENT_NAMES);
    // Every probe resolved to something real (an unresolved name renders as `any`).
    expect(Object.values(sigs).filter(s => s === "any")).toEqual([]);
    expect(render(sigs)).toMatchSnapshot();
  });

  // The module string is the compiler's, not a literal: Solid 2 moved `solid-js/web` out into
  // `@solidjs/web`, and a stale literal here would probe a module that no longer resolves.
  test(`${SOLID_WEB_MODULE} surface`, () => {
    const sigs = realSignatures(SOLID_WEB_MODULE, SOLID_WEB_NAMES);
    expect(Object.values(sigs).filter(s => s === "any")).toEqual([]);
    expect(render(sigs)).toMatchSnapshot();
  });

  test("prelude component surface", () => {
    const sigs = realSignatures("@nota-lang/prelude", AMBIENT_PRELUDE_NAMES);
    expect(Object.values(sigs).filter(s => s === "any")).toEqual([]);
    expect(render(sigs)).toMatchSnapshot();
  });
});

// Sanity: the prelude's own .d.ts is present (the snapshot is meaningless against a stale dist).
test("prelude types are built", () => {
  expect(
    readFileSync(
      join(
        PKG_ROOT,
        "node_modules",
        "@nota-lang",
        "prelude",
        "dist",
        "lib.d.ts"
      ),
      "utf8"
    ).length
  ).toBeGreaterThan(0);
});
