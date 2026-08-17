/**
 * Doc-state **sugars** e2e (`tests/fixtures/sugars.nota`): the same full pipeline as
 * ./e2e.test.ts, but the fixture uses ONLY the inline sugar forms — `<label>` anchors, `&ref`
 * cross-references, `[^n]` footnote marks and `[^n]: body` definitions — never the element
 * forms (`@Label[...]`, `@Ref[...]`, `@Footnote{}`). The sugars are reader rewrites *to* the
 * element forms (notation.md §Doc-state references), so the rendered numbering/links must be
 * indistinguishable from what the element-form e2e pins.
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
  const mod = (await server.ssrLoadModule(
    "/tests/fixtures/sugars-entry.ts"
  )) as {
    run: () => { html: string; stateScript: string };
  };
  const out = mod.run();
  html = clean(out.html);
  stateScript = out.stateScript;
}, 60_000);

afterAll(async () => {
  await server?.close();
});

describe("doc-state sugars render the element forms' numbering", () => {
  test("<label> anchors the enclosing heading; &ref resolves forward and backward", () => {
    // The forward `&sec-usage` (written under §1) resolves to section 2's id + number…
    expect(html).toMatch(/<a href="#usage" class="nota-ref">2<\/a>/);
    // …and the backward `&sec-intro` to section 1's. Same shape the element-form e2e asserts.
    expect(html).toMatch(/<a href="#introduction" class="nota-ref">1<\/a>/);
    expect(html.match(/class="nota-ref"/g)).toHaveLength(2);
    // The <sec-intro> anchor itself renders nothing visible — no stray text in the paragraph.
    expect(html).not.toContain("sec-intro<");
  });

  test("[^n] marks number in order and share entries; [^n]: bodies form the list", () => {
    // First `[^a]` carries the backlink id; the repeat shares number 1 without one.
    expect(html).toContain(
      '<sup class="nota-fnref"><a id="fnref-1" href="#fn-1">1</a></sup>'
    );
    expect(html).toContain(
      '<sup class="nota-fnref"><a href="#fn-1">1</a></sup>'
    );
    expect(html).toContain(
      '<sup class="nota-fnref"><a id="fnref-2" href="#fn-2">2</a></sup>'
    );
    const fns = /<section class="nota-footnotes">([\s\S]*?)<\/section>/.exec(
      html
    );
    expect(fns).toBeTruthy();
    expect(fns?.[1]).toContain('<li id="fn-1">');
    expect(fns?.[1]).toContain("The shared note body.");
    expect(fns?.[1]).toContain("The second note body.");
    // Two entries — the shared mark did not duplicate its body.
    expect(fns?.[1]?.match(/<li id="fn-/g)).toHaveLength(2);
  });

  test("the snapshot carries the sugar-registered facts", () => {
    const inner = />(.*)<\/script>$/.exec(stateScript)?.[1] ?? "";
    const snapshot = JSON.parse(inner) as {
      label?: Array<{ key: string }>;
      footnote?: Array<{ label?: string }>;
    };
    expect(snapshot.label?.map(l => l.key)).toEqual(["sec-intro", "sec-usage"]);
    expect(snapshot.footnote?.map(f => f.label)).toEqual(["a", "a", "b"]);
  });
});
