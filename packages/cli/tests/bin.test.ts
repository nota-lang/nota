/**
 * Smoke test for the **shipped binary** (`bin/nota.mjs` → `dist/cli.js`): build the dist bundle
 * from source, then spawn the bin under plain `node` on the repo's feature mega-test.
 *
 * The programmatic-API tests cannot catch packaging regressions — a CJS-format break
 * (`createRequire(import.meta.url)` in an inlined dep) and a missing runtime dependency
 * (`@nota-lang/compiler`) both shipped while the suite was green, because vitest resolves
 * imports through its own transform pipeline instead of node's. This test runs node's.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Vitest runs with cwd = packages/cli.
const PKG = process.cwd();
const MEGA = resolve(PKG, "../../integration/mega.nota");

const outDir = mkdtempSync(join(tmpdir(), "nota-bin-"));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe("the nota bin", () => {
  it("builds the mega-test document via dist/cli.js under plain node", () => {
    // Rebuild dist from the current source so the smoke never runs against a stale bundle.
    execFileSync(join(PKG, "node_modules/.bin/vite"), ["build"], {
      cwd: PKG,
      stdio: "pipe"
    });

    const stdout = execFileSync(
      "node",
      [join(PKG, "bin/nota.mjs"), "build", MEGA, "-o", outDir],
      { stdio: "pipe" }
    ).toString();
    expect(stdout).toContain("hydrating Solid app");

    const html = readFileSync(join(outDir, "index.html"), "utf8");
    expect(html).toContain('id="nota-doc-state"');
    expect(html).toContain('display="block"'); // the fence-form display math
    expect(html).toContain("The TeXbook"); // bibliography rendered
    expect(existsSync(join(outDir, "assets"))).toBe(true);
  });
});
