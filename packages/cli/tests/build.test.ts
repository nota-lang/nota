/**
 * **CLI golden / build tests.**
 *
 * Drive {@link buildNotaFile} on the shared fixtures (their REAL paths — doc-relative imports are
 * part of the contract now) and assert the CLI's pinned properties:
 *
 *   - **zero-`<script>` for an island-free doc** (`static.nota`: headings/paragraphs/list) — no
 *     manifest ⇒ no client build ⇒ a pure static page, and a pure-markup doc emits **only**
 *     `index.html` (no assets/ at all);
 *   - the **islands path** (`golden.nota`) — the exact SSG body HTML, the manifest debug JSON, a
 *     `<script src="./assets/index.js">` reference, and a self-contained IIFE bundle on disk;
 *   - the **asset pipeline** (`asset.nota`) — a `?url` svg import and a CSS import flow through
 *     vite: emitted under `assets/`, referenced page-relative from the HTML (the point of the
 *     vite-based pipeline);
 *   - structural snapshots of the emitted document.
 *
 * Node env: the pipeline runs the in-process wasm reader (needs the node-target wasm build,
 * `oxc/napi/nota_wasm/pkg-node`) and two programmatic vite builds; `resolveFrom` is the package
 * root so the pinned resolver finds `react` / `@nota-lang/*` in this package's `node_modules`.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type BuildOutput, buildNota, buildNotaFile } from "../src/build";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, ".."); // packages/cli — its node_modules has the deps linked
const integrationDir = join(here, "..", "..", "..", "integration");

/** All fixture builds land under one temp base, cleaned after the suite. */
const outBase = mkdtempSync(join(tmpdir(), "nota-out-"));
afterAll(() => rmSync(outBase, { recursive: true, force: true }));

/** Build a fixture by its real path, into its own out dir under the temp base. */
async function build(name: string, sub = ""): Promise<BuildOutput> {
  return buildNotaFile(join(integrationDir, name), {
    resolveFrom: pkgRoot,
    outDir: join(outBase, `${basename(name, ".nota")}${sub}`)
  });
}

// =============================================================================================
// island-free doc — the zero-JS property
// =============================================================================================

describe("CLI golden — island-free doc (static.nota): zero-JS, index.html only", () => {
  let out: BuildOutput;
  beforeAll(async () => {
    out = await build("static.nota");
  });

  test("no islands ⇒ empty manifest ⇒ hasIslands false", () => {
    expect(out.hasIslands).toBe(false);
    expect(out.manifest).toEqual({});
  });

  test("ZERO <script>: a pure static page (the zero-JS property)", () => {
    expect(out.html).not.toMatch(/<script/i);
    expect(out.clientJsPath).toBeUndefined();
  });

  test("a pure-markup doc emits exactly one file: index.html (no assets/, no <link>)", () => {
    expect(readdirSync(out.outDir)).toEqual(["index.html"]);
    expect(out.cssFiles).toEqual([]);
    expect(out.html).not.toMatch(/<link/i);
  });

  test("a complete HTML document (doctype, head, body)", () => {
    expect(out.html).toMatch(/^<!doctype html>/i);
    expect(out.html).toContain("<head>");
    expect(out.html).toContain("<body>");
    expect(out.html).toContain("</html>");
    // title defaults to the input basename.
    expect(out.html).toContain("<title>static</title>");
    // the written index.html is the returned html.
    expect(readFileSync(join(out.outDir, "index.html"), "utf8")).toBe(out.html);
  });

  test("the SSG body grouped headings/paras/list (struct ran): sections, <p>, <ul>", () => {
    // decode.md grouping: headings own following content in <section>; inline runs → <p>;
    // `-` list items coalesce into one <ul>.
    // `#` sugar now re-lowers to the ambient `Heading` slot: the concrete <hN>
    // carries a slugified `id` (numbering is off by default — secset numberDepth 0).
    expect(out.html).toContain('<section><h1 id="hello-nota">Hello Nota</h1>');
    expect(out.html).toContain("<strong>static</strong>");
    expect(out.html).toContain("<em>no</em>");
    expect(out.html).toContain(
      "<ul><li>first item</li><li>second item</li><li>third item"
    );
    // nested section for the h2 (also id'd by the Heading slot).
    expect(out.html).toContain(
      '<h2 id="a-second-section">A second section</h2>'
    );
  });
});

// =============================================================================================
// islands doc — the golden (Colorized)
// =============================================================================================

describe("CLI golden — islands doc (golden.nota): SSG body + client bundle + manifest", () => {
  let out: BuildOutput;
  beforeAll(async () => {
    out = await build("golden.nota");
  });

  test("two Colorized islands in the manifest ({comp} only — debug metadata)", () => {
    expect(out.hasIslands).toBe(true);
    expect(out.manifest).toEqual({
      "1": { comp: "Colorized" },
      "2": { comp: "Colorized" }
    });
  });

  test("the SSG body is the exact final HTML (nota-ul-li coalesced, islands SSR'd color:red)", () => {
    expect(out.html).toContain(
      '<ul><li><nota-island data-hydration-id="1"><span style="color:red">a</span></nota-island></li>' +
        '<li><nota-island data-hydration-id="2"><span style="color:red">b</span></nota-island></li></ul>'
    );
    // onClick must NOT appear in the static HTML (it ships in the island JS).
    const body = out.html.slice(0, out.html.indexOf("<script"));
    expect(body).not.toMatch(/onclick/i);
  });

  test("a client <script src> + the manifest as JSON debug metadata", () => {
    // The replay bundle is a page-relative classic script (an IIFE — not a module, so it also
    // works over file://).
    expect(out.html).toContain('<script src="./assets/index.js"></script>');
    // The manifest is inlined as application/json DEBUG metadata (hydration never
    // reads it — the client replays Doc; it remains inspectable + gates hasIslands).
    expect(out.html).toContain(
      '<script type="application/json" id="nota-manifest">{"1":{"comp":"Colorized"},"2":{"comp":"Colorized"}}</script>'
    );
    // ...and the bundle it references was written where the return value says.
    expect(out.clientJsPath).toBe(join(out.outDir, "assets", "index.js"));
    expect(out.clientJsPath && existsSync(out.clientJsPath)).toBe(true);
  });

  test("the bundle is self-contained: React + the runtime replay, no import/export statements", () => {
    const bundle = readFileSync(out.clientJsPath ?? "", "utf8");
    // Proof the client bundle carries React's client + the replay-hydration call
    // (hydrateDocument), not a bare import. (React's renderToString also ships — the replay SSRs
    // nested-in-slot islands client-side.)
    expect(bundle).toMatch(/createElement|jsx/);
    expect(bundle).toContain("hydrateRoot");
    // An IIFE has no module syntax — what makes the jsdom e2e's realm-eval faithful.
    expect(bundle).not.toMatch(/^\s*import\s/m);
    expect(bundle).not.toMatch(/^\s*export\s/m);
  });

  test("a custom --title is honored", async () => {
    const titled = await buildNotaFile(join(integrationDir, "golden.nota"), {
      resolveFrom: pkgRoot,
      title: "My Doc",
      outDir: join(outBase, "golden-titled")
    });
    expect(titled.html).toContain("<title>My Doc</title>");
  });
});

// =============================================================================================
// the asset pipeline — ?url + CSS imports (the point of the vite-based build)
// =============================================================================================

describe("CLI assets — asset.nota: ?url svg + CSS import flow through vite", () => {
  let out: BuildOutput;
  beforeAll(async () => {
    out = await build("asset.nota");
  });

  test("still static: assets don't make a doc an island", () => {
    expect(out.hasIslands).toBe(false);
    expect(out.html).not.toMatch(/<script/i);
  });

  test("the ?url svg is emitted under assets/ and referenced page-relative from the HTML", () => {
    const m = out.html.match(/<img src="(\.\/assets\/sample-[\w-]+\.svg)"/);
    expect(m).not.toBeNull();
    // the URL the SSR baked into the HTML names a file that exists in the out dir.
    expect(existsSync(join(out.outDir, m?.[1] ?? ""))).toBe(true);
  });

  test("the CSS import is emitted and <link>ed in <head>", () => {
    expect(out.cssFiles.length).toBe(1);
    const href = `./${out.cssFiles[0]}`;
    expect(out.html).toContain(`<link rel="stylesheet" href="${href}" />`);
    const css = readFileSync(join(out.outDir, out.cssFiles[0]), "utf8");
    // the fixture's marker rule survived the pipeline (the production minifier normalizes
    // rgb(1, 2, 3) → #010203; dev builds keep the rgb form).
    expect(css).toMatch(/#010203|rgb\(1,\s*2,\s*3\)/);
  });
});

// =============================================================================================
// errors
// =============================================================================================

describe("CLI build — reader diagnostics surface", () => {
  test("a malformed .nota rejects with the reader's diagnostic", async () => {
    await expect(
      buildNota("@p{unterminated", {
        sourcePath: "bad.nota",
        resolveFrom: pkgRoot
      })
    ).rejects.toThrow(/failed to compile/i);
  });

  test("a missing input file is a pointed error", async () => {
    await expect(
      buildNotaFile(join(integrationDir, "no-such.nota"), {
        resolveFrom: pkgRoot
      })
    ).rejects.toThrow(/not found/);
  });
});
