/**
 * **CLI build tests** — drive {@link buildNotaFile}/{@link buildNota} on the shared fixtures and
 * assert the pipeline's pinned properties:
 *
 * - **`--static` = zero-JS**: no `<script>` of any kind, no client build; a pure-markup doc
 *   emits only `index.html` (no `assets/` at all), reforested (sections/paragraphs/list).
 * - **default = hydrating Solid app**: the Solid hydration bootstrap in `<head>`, the doc-state
 *   snapshot JSON, a `<script src="./assets/index.js">`, and a self-contained IIFE on disk.
 * - **the asset pipeline** (`asset.nota`): a `?url` svg import and a CSS import flow through
 *   vite — emitted under `assets/`, referenced page-relative; a css-hosted asset reference (the
 *   KaTeX-fonts shape) is rewritten off the SSR build's root-absolute `/assets/…` form and
 *   resolves on disk.
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
    // The doc-state snapshot (static.nota has headings → heading anchors).
    const state =
      /<script type="application\/json" id="nota-doc-state">([\s\S]*?)<\/script>/.exec(
        out.html
      );
    expect(state).toBeTruthy();
    const snapshot = JSON.parse(state?.[1] ?? "[]") as Array<{
      kind: string;
      fact: { kind?: string };
    }>;
    expect(
      snapshot.filter(
        entry => entry.kind === "anchor" && entry.fact.kind === "heading"
      )
    ).toHaveLength(2);
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

  test("a hydrating build links CSS too (the IIFE client emits none; SSR's is used)", async () => {
    const outDir = join(tmpBase, "asset-hydrated");
    const out = await buildNotaFile(join(integrationDir, "asset.nota"), {
      resolveFrom: pkgRoot,
      outDir
    });
    expect(out.hydrated).toBe(true);
    expect(out.cssFiles.length).toBe(1);
    expect(out.html).toContain(
      `<link rel="stylesheet" href="./${out.cssFiles[0]}" />`
    );
    expect(existsSync(join(outDir, out.cssFiles[0]))).toBe(true);
  });

  test("css-hosted asset URLs (the KaTeX-fonts shape) are rewritten off /assets/ and resolve on disk", async () => {
    // copySsrAssets' CSS repair (build.ts) rests on the assetFileNames scheme: the SSR build
    // resolves a css-hosted asset reference (a stylesheet's fonts — what KaTeX's css does) to a
    // root-absolute `/assets/…` URL regardless of the relative `base`; an island-free doc ships
    // that CSS as-is, so the root-absolute form must be repaired to css-relative or the font 404s
    // on any non-root deploy. Pin it explicitly with a synthetic stylesheet + asset, rather than
    // relying on it incidentally holding for some other fixture's CSS.
    const dir = mkdtempSync(join(tmpdir(), "nota-cssrel-"));
    try {
      writeFileSync(
        join(dir, "pic.svg"),
        `<svg xmlns="http://www.w3.org/2000/svg"/>`
      );
      writeFileSync(
        join(dir, "f.css"),
        "body { background-image: url(./pic.svg); }"
      );
      writeFileSync(join(dir, "doc.nota"), '%import "./f.css"\n\nHello\n');
      const out = await buildNotaFile(join(dir, "doc.nota"), {
        resolveFrom: pkgRoot,
        static: true,
        outDir: join(dir, "out")
      });
      expect(out.cssFiles.length).toBe(1);
      const css = readFileSync(join(out.outDir, out.cssFiles[0]), "utf8");
      const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m =>
        m[1].replace(/["']/g, "")
      );
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls) {
        expect(u.startsWith("/"), `still root-absolute: ${u}`).toBe(false);
        expect(
          existsSync(join(out.outDir, dirname(out.cssFiles[0]), u)),
          `rewritten url resolves to nothing on disk: ${u}`
        ).toBe(true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("--setup", () => {
  test("a site lstset runs before render (highlighted code in static HTML)", async () => {
    const setupPath = join(tmpBase, "setup.mjs");
    // `lang` selects a default for *untagged* fences, which carry no tag for the compiler to
    // auto-import from — so a setup module still registers the grammar itself, and the pinned
    // resolver has to reach shiki for it.
    writeFileSync(
      setupPath,
      `import { lstset } from "@nota-lang/prelude";\n` +
        `import js from "shiki/langs/js.mjs";\n` +
        `lstset({ lang: "js", langs: [js] });\n`
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
    // Exactly ONE Solid client runtime in the bundle — the resolve.dedupe invariant (a second
    // solid-js copy leaves enableHydration() uncalled in one of them, so claiming silently
    // misses). Marker: "_$DX_DELEGATE", dom-expressions' event-delegation registry key. It is a
    // quoted property-name STRING (minification cannot rename it), it appears exactly once in
    // solid-js/web's client runtime (verified against the shipped dist), and it is absent from
    // app code — so its count equals the number of bundled Solid runtimes.
    expect(bundle.match(/_\$DX_DELEGATE/g)).toHaveLength(1);
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
