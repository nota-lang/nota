/**
 * **Part 4 — CLI golden / build tests** (implementation.md §4.5 layer 1).
 *
 * Drive {@link buildNota} on the two shared fixtures and assert the CLI's pinned properties:
 *
 *   - **self-containment** — the emitted HTML references **no external** resource (`src=`/`href=` as a
 *     real HTML attribute, ignoring substrings inside the inlined `<script>`/`<style>` text);
 *   - **zero-`<script>` for an island-free doc** (`static.nota`: headings/paragraphs/list) — no
 *     manifest ⇒ no client bundle ⇒ a pure static page;
 *   - the **islands path** (`golden.nota`) — the exact stage-5 body HTML, the inlined manifest, and an
 *     inlined client `<script>` (no `src`);
 *   - structural snapshots of the inlined output.
 *
 * Node env: the pipeline spawns the reader (needs the pre-built `oxc/target/release/examples/
 * nota_compile`), runs esbuild, and `require`s the SSR bundle. `resolveFrom` is the package root so
 * esbuild resolves `react` / `@nota-lang/*` from this package's `node_modules`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type BuildOutput, buildNota } from "../src/build";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, ".."); // packages/cli — its node_modules has the deps linked
const integrationDir = join(here, "..", "..", "..", "integration");
const read = (name: string) => readFileSync(join(integrationDir, name), "utf8");

/** Strip the text content of `<script>`/`<style>` so attribute scans don't trip on bundled JS. */
function stripInlineCode(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "<style></style>");
}

/** Build a fixture once, with the package root as the esbuild resolution base. */
async function build(name: string): Promise<BuildOutput> {
  return buildNota(read(name), { sourcePath: name, resolveFrom: pkgRoot });
}

// =============================================================================================
// island-free doc — the zero-JS property
// =============================================================================================

describe("CLI golden — island-free doc (static.nota): zero-JS, self-contained", () => {
  let out: BuildOutput;
  beforeAll(async () => {
    out = await build("static.nota");
  });

  test("no islands ⇒ empty manifest ⇒ hasIslands false", () => {
    expect(out.hasIslands).toBe(false);
    expect(out.manifest).toEqual({});
  });

  test("ZERO <script>: a pure static page (the §4.1 zero-JS property)", () => {
    expect(out.html).not.toMatch(/<script/i);
  });

  test("self-contained: no external src/href anywhere", () => {
    const stripped = stripInlineCode(out.html);
    expect(stripped).not.toMatch(/\bsrc=/i);
    expect(stripped).not.toMatch(/\bhref=/i);
  });

  test("a complete HTML document (doctype, head, body)", () => {
    expect(out.html).toMatch(/^<!doctype html>/i);
    expect(out.html).toContain("<head>");
    expect(out.html).toContain("<body>");
    expect(out.html).toContain("</html>");
    // title defaults to the input basename.
    expect(out.html).toContain("<title>static</title>");
  });

  test("the SSG body grouped headings/paras/list (struct ran): sections, <p>, <ul>", () => {
    // decode.md grouping: headings own following content in <section>; inline runs → <p>;
    // `-` list items coalesce into one <ul>.
    expect(out.html).toContain("<section><h1>Hello Nota</h1>");
    expect(out.html).toContain("<strong>static</strong>");
    expect(out.html).toContain("<em>no</em>");
    expect(out.html).toContain(
      "<ul><li>first item</li><li>second item</li><li>third item"
    );
    // nested section for the h2.
    expect(out.html).toContain("<h2>A second section</h2>");
  });
});

// =============================================================================================
// islands doc — the golden (Colorized)
// =============================================================================================

describe("CLI golden — islands doc (golden.nota): SSG body + inlined bundle + manifest", () => {
  let out: BuildOutput;
  beforeAll(async () => {
    out = await build("golden.nota");
  });

  test("two Colorized islands in the manifest (contract §2 stage-5)", () => {
    expect(out.hasIslands).toBe(true);
    expect(out.manifest).toEqual({
      "1": { comp: "Colorized", props: {} },
      "2": { comp: "Colorized", props: {} }
    });
  });

  test("the SSG body is the exact stage-5 HTML (ulli coalesced, islands SSR'd color:red)", () => {
    expect(out.html).toContain(
      '<ul><li><nota-island data-hydration-id="1"><span style="color:red">a</span></nota-island></li>' +
        '<li><nota-island data-hydration-id="2"><span style="color:red">b</span></nota-island></li></ul>'
    );
    // onClick must NOT appear in the static HTML (it ships in the island JS).
    const body = out.html.slice(0, out.html.indexOf("<script"));
    expect(body).not.toMatch(/onclick/i);
  });

  test("an inlined client <script> (module) + the manifest as JSON metadata", () => {
    // The boot bundle is inlined as a module script (content present, not an external src).
    expect(out.html).toMatch(/<script type="module">[\s\S]+<\/script>/);
    // The manifest is inlined as application/json metadata.
    expect(out.html).toContain(
      '<script type="application/json" id="nota-manifest">{"1":{"comp":"Colorized","props":{}},"2":{"comp":"Colorized","props":{}}}</script>'
    );
    // The two script tags the CLI emits are exactly these two opening forms (the inlined bundle text
    // may itself contain `<script src=…>` *substrings* — react-dom/server source — so the
    // authoritative "no external resource" check is the DOM-based one in the hydration e2e).
    expect(out.html).toContain(
      '<script type="application/json" id="nota-manifest">'
    );
    expect(out.html).toContain('<script type="module">');
  });

  test("the bundle actually inlined React + the runtime boot (createElement/hydrateRoot/bootIslands)", () => {
    // Proof the client bundle is self-contained: it carries React's client + the boot call, not a
    // bare import. (These appear inside the minified bundle text.)
    expect(out.html).toMatch(/createElement|jsx/);
    expect(out.html).toContain("hydrateRoot");
  });

  test("a custom --title is honored", async () => {
    const titled = await buildNota(read("golden.nota"), {
      sourcePath: "golden.nota",
      title: "My Doc",
      resolveFrom: pkgRoot
    });
    expect(titled.html).toContain("<title>My Doc</title>");
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
});
