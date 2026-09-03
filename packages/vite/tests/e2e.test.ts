/**
 * The full-pipeline e2e: a real `.nota` file → the nota() preset (reader's native Solid JSX
 * emit → vite-plugin-solid SSR compile) → `renderDocument` (fixpoint, seeded) — executed inside
 * the Vite SSR module graph via a fixture entry, so the doc-state context is one instance.
 *
 * This is the live loop the old `packages/react/tests/integration.test.ts` + compiler e2e
 * closed for the h-call architecture, rebuilt for the Solid one.
 */
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { nota } from "../src/lib";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));

let server: ViteDevServer;
let html = "";
let stateScript = "";

const clean = (h: string) =>
  h.replace(/\s*data-hk="[^"]*"/g, "").replace(/<!--\/?!?\$?-->/g, "");

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: pkgRoot,
    plugins: [nota()],
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error"
  });
  const mod = (await server.ssrLoadModule("/tests/fixtures/ssg-entry.ts")) as {
    run: () => { html: string; stateScript: string };
  };
  const out = mod.run();
  html = clean(out.html);
  stateScript = out.stateScript;
}, 60_000);

afterAll(async () => {
  await server?.close();
});

describe("nota() → renderDocument, end to end", () => {
  test("the document reforests: paragraphs, sections, coalesced list", () => {
    expect(html).toMatch(/^<article class="nota-doc"/);
    expect(html).toMatch(/<p class="nota-para">Hello <strong>world<\/strong>/);
    expect(html.match(/<section class="nota-section"/g)?.length).toBe(2);
    const list = /<ul class="nota-list">([\s\S]*?)<\/ul>/.exec(html);
    expect(list?.[1]).toContain("item one");
    expect(list?.[1]).toContain("item two");
  });

  test("headings number and the forward Toc resolves", () => {
    expect(html).toMatch(
      /<h1 id="introduction" ?><span class="nota-secnum">1<\/span>/
    );
    expect(html).toMatch(
      /<h1 id="usage" ?><span class="nota-secnum">2<\/span>/
    );
    const nav = /<nav class="nota-toc">([\s\S]*?)<\/nav>/.exec(html);
    expect(nav).toBeTruthy();
    expect(nav?.[1]).toContain("1 Introduction");
    expect(nav?.[1]).toContain("2 Usage");
    expect(html.indexOf("<nav")).toBeLessThan(
      html.indexOf('id="introduction"')
    );
  });

  test("the forward Ref resolves to the labeled section's number", () => {
    expect(html).toMatch(/<a href="#usage"[^>]*class="nota-ref"[^>]*>2<\/a>/);
  });

  test("math and code render (KaTeX MathML, shiki-less inline code)", () => {
    expect(html).toMatch(/<span class="nota-tex"[^>]*><span class="katex"/);
    expect(html).toMatch(/<code class="nota-code-inline"[^>]*>f\(x\)/);
  });

  test("the definition anchors, its ref, the note, and the trailers land", () => {
    expect(html).toMatch(
      /<span id="def-nota" class="nota-def"[^>]*>Nota<\/span>/
    );
    expect(html).toMatch(
      /<a href="#def-nota"[^>]*data-nota-def="nota"[^>]*>Nota<\/a>/
    );
    expect(html).toMatch(
      /<sup class="nota-noteref"><a id="noteref-1" href="#note-1"/
    );
    // Trailers at document end: note list, then the def tooltip bank.
    expect(html).toMatch(/<section class="nota-notes">/);
    expect(html).toContain("Documents are programs.");
    expect(html).toMatch(/<div class="nota-def-tooltips" aria-hidden="true">/);
  });

  test("the state script embeds the converged snapshot (anchor/ref wire format)", () => {
    expect(stateScript).toContain('id="nota-doc-state"');
    const inner = />(.*)<\/script>$/.exec(stateScript)?.[1] ?? "";
    const snapshot = JSON.parse(inner) as Array<{
      kind: string;
      fact: { kind?: string; id?: string; title?: string; target?: string };
    }>;
    const anchors = snapshot
      .filter(entry => entry.kind === "anchor")
      .map(entry => entry.fact);
    expect(anchors.filter(a => a.kind === "heading").map(a => a.title)).toEqual(
      ["Introduction", "Usage"]
    );
    expect(anchors.find(a => a.kind === "def")?.id).toBe("nota");
    expect(snapshot.filter(entry => entry.kind === "ref")).not.toHaveLength(0);
  });
});
