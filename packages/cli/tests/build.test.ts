/**
 * **CLI build tests** — drive {@link buildNotaFile}/{@link buildNota} on the shared fixtures and
 * assert the pipeline's pinned properties:
 *
 * - **`--static` = zero-JS**: no `<script>` of any kind, no client build; a pure-markup doc
 *   emits only `index.html` (no `assets/` at all), reforested (sections/paragraphs/list).
 * - **default = hydrating Solid app**: the Solid hydration bootstrap in `<head>`, the doc-state
 *   snapshot JSON, a `<script src="./assets/index.js">`, and a self-contained IIFE on disk.
 * - **the asset pipeline** (`asset.nota`): a `?url` svg import and a CSS import flow through
 *   vite — emitted under `assets/`, referenced page-relative.
 * - **`--setup`**: a site module's `lstset` runs before render (shiki-highlighted output).
 * - a reader diagnostic fails the build with the compile error reachable.
 */

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { buildNota, buildNotaFile } from "../src/build";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, ".."); // packages/cli — its node_modules has the deps linked
const integrationDir = join(here, "..", "..", "..", "integration");

const tmpBase = mkdtempSync(join(tmpdir(), "nota-cli-test-"));
afterAll(() => rmSync(tmpBase, { recursive: true, force: true }));

const clean = (h: string) =>
  h.replace(/\s*data-hk="[^"]*"/g, "").replace(/<!--\/?!?\$?-->/g, "");

describe("static build (--static: zero-JS)", () => {
  test("a pure-markup doc emits only index.html, reforested, script-free", async () => {
    const outDir = join(tmpBase, "static");
    const out = await buildNotaFile(join(integrationDir, "static.nota"), {
      resolveFrom: pkgRoot,
      outDir,
      static: true
    });
    expect(out.hydrated).toBe(false);
    expect(out.clientJsPath).toBeUndefined();
    // Only index.html — a pure doc has no assets at all.
    expect(readdirSync(outDir)).toEqual(["index.html"]);
    const html = clean(out.html);
    expect(html).not.toContain("<script");
    // Reforested structure in dead HTML.
    expect(html).toMatch(/<h1[^>]*id="hello-nota"/);
    expect(html).toMatch(/<section class="nota-section"/);
    expect(html.match(/<ul class="nota-list">/g)).toHaveLength(1);
    expect(html.match(/<li[^>]*data-list="ul"/g)).toHaveLength(3);
    expect(html).toMatch(/<p class="nota-para">/);
    expect(html).toContain("<strong>static</strong>");
    expect(html).toContain("<em>no</em>");
  });
});

describe("default build (hydrating Solid app)", () => {
  test("emits the hydration bootstrap, the state snapshot, and the client IIFE", async () => {
    const outDir = join(tmpBase, "hydrating");
    const out = await buildNotaFile(join(integrationDir, "static.nota"), {
      resolveFrom: pkgRoot,
      outDir
    });
    expect(out.hydrated).toBe(true);
    // Solid's hydration bootstrap in head (defines _$HY + event capture).
    expect(out.html).toContain("_$HY");
    // The doc-state snapshot (static.nota has headings → heading facts).
    const state =
      /<script type="application\/json" id="nota-doc-state">([\s\S]*?)<\/script>/.exec(
        out.html
      );
    expect(state).toBeTruthy();
    const snapshot = JSON.parse(state?.[1] ?? "{}");
    expect(snapshot.heading?.length).toBe(2);
    // The client bundle: referenced page-relative, on disk, self-contained IIFE.
    expect(out.html).toContain('<script src="./assets/index.js"></script>');
    expect(out.clientJsPath).toBeTruthy();
    expect(existsSync(out.clientJsPath as string)).toBe(true);
    const js = readFileSync(out.clientJsPath as string, "utf8");
    expect(js).not.toMatch(/^\s*import\b/m); // IIFE, not a module
  });
});

describe("the asset pipeline", () => {
  test("?url svg + css imports emit under assets/ and link page-relative", async () => {
    const outDir = join(tmpBase, "asset");
    const out = await buildNotaFile(join(integrationDir, "asset.nota"), {
      resolveFrom: pkgRoot,
      outDir,
      static: true
    });
    const assets = readdirSync(join(outDir, "assets"));
    expect(assets.some(f => f.endsWith(".svg"))).toBe(true);
    expect(out.cssFiles.length).toBe(1);
    expect(out.html).toContain(
      `<link rel="stylesheet" href="./${out.cssFiles[0]}" />`
    );
    // The svg URL is baked page-relative into the img.
    expect(out.html).toMatch(/<img[^>]*src="\.\/assets\/[^"]+\.svg"/);
  });
});

describe("--setup", () => {
  test("a site lstset runs before render (highlighted code in static HTML)", async () => {
    const setupPath = join(tmpBase, "setup.mjs");
    writeFileSync(
      setupPath,
      `import { lstset } from "@nota-lang/prelude";\nlstset({ lang: "js" });\n`
    );
    const out = await buildNota("Some code:\n\n```\nlet x = 1;\n```\n", {
      sourcePath: "code.nota",
      resolveFrom: pkgRoot,
      setupModule: setupPath,
      static: true,
      outDir: join(tmpBase, "setup-out")
    });
    expect(out.html).toContain('<pre class="shiki');
  });
});

describe("production artifact", () => {
  test("the client bundle carries production Solid even under an ambient NODE_ENV", async () => {
    // This suite runs with NODE_ENV=test (vitest). Vite fills NODE_ENV from `mode` only when
    // UNSET, and solid-js's `development` export condition keys off it — without the pipeline
    // pinning NODE_ENV, shipped bundles silently carried Solid's dev build (its dev-only
    // "multiple instances of Solid" banner is the marker asserted on here).
    const out = await buildNota("Just *text*.\n", {
      sourcePath: "env.nota",
      resolveFrom: pkgRoot,
      outDir: join(tmpBase, "env-out")
    });
    expect(out.clientJsPath).toBeDefined();
    const bundle = readFileSync(out.clientJsPath as string, "utf8");
    expect(bundle).not.toContain("multiple instances of Solid");
  });
});

describe("diagnostics", () => {
  test("a malformed doc fails the build with the reader's message reachable", async () => {
    await expect(
      buildNota("@p{unterminated", {
        sourcePath: "bad.nota",
        resolveFrom: pkgRoot,
        outDir: join(tmpBase, "bad-out")
      })
    ).rejects.toThrow(/failed to compile/);
  });
});
