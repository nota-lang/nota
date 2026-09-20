/** Self-hosted SSR: resolved references, per-document seeds, streaming, and convergence failures. */
import type { JSX } from "@solidjs/web";
import { renderToStream, renderToString } from "@solidjs/web";
import { Loading, lazy } from "solid-js";
import { afterEach, describe, expect, test } from "vitest";
import { DOC_STATE_ID, renderDocument, setDocRenderDefaults } from "../src/lib";
import {
  DivergentDoc,
  Doc,
  OtherDoc,
  Pair,
  PlainRoute,
  SettlingDoc,
  SmartDoc
} from "./fixtures/host-doc";

/** The host's shape: one render of the whole page, document included. */
function renderPage(app: () => JSX.Element): string {
  return renderToString(() => (
    <html lang="en">
      <head></head>
      <body>
        <div id="app">{app()}</div>
      </body>
    </html>
  ));
}

/** Suspend past the shell flush to exercise streamed head insertion. lazy requires a manifest. */
function renderLazyPage(App: () => JSX.Element): Promise<string> {
  const LazyApp = lazy(async () => {
    await Promise.resolve();
    return { default: App };
  });
  return Promise.resolve(
    renderToStream(
      () => (
        <html lang="en">
          <head></head>
          <body>
            <div id="app">
              <Loading>
                <LazyApp />
              </Loading>
            </div>
          </body>
        </html>
      ),
      { manifest: { _base: "/" } }
    )
  );
}

const STATE_SCRIPT_RE = new RegExp(
  `<script[^>]*\\bid="(${DOC_STATE_ID}[^"]*)"[^>]*>(.*?)</script>`,
  "g"
);

type Snapshot = { kind: string; fact: Record<string, unknown> }[];

/** Every doc-state script on the page, as `[id, snapshot]` pairs, in document order. */
const seedsOf = (html: string): [string, Snapshot][] =>
  [...html.matchAll(STATE_SCRIPT_RE)].map(m => [m[1], JSON.parse(m[2])]);

const seedOf = (html: string): Snapshot => {
  const all = seedsOf(html);
  expect(all).toHaveLength(1);
  return all[0][1];
};

const headingIds = (seed: Snapshot) =>
  seed.filter(entry => entry.kind === "heading").map(entry => entry.fact.id);

afterEach(() => setDocRenderDefaults({}));

describe("a self-hosted document (server)", () => {
  test("forward references are resolved in the server bytes", () => {
    const html = renderPage(() => <Doc />);
    const nav = /<nav[^>]*class="toc"[^>]*>(.*?)<\/nav>/.exec(html);
    expect(nav).toBeTruthy();
    // The Toc renders before the headings exist, yet lists them.
    expect(nav?.[1]).toContain("Alpha");
    expect(nav?.[1]).toContain("Beta");
    expect(html.indexOf("<nav")).toBeLessThan(html.indexOf('id="alpha"'));
  });

  test("the head carries the converged snapshot under a hydration-keyed id", () => {
    const html = renderPage(() => <Doc />);
    const [[id, seed]] = seedsOf(html);
    expect(headingIds(seed)).toEqual(["alpha", "beta"]);
    // The id (and the useHead dedupe key beside it) carry the document's hydration key, so a
    // page with two documents keeps two seeds apart. `nota-doc-state` bare is the cli's id.
    expect(id).toMatch(new RegExp(`^${DOC_STATE_ID}-.+$`));
    expect(html).toContain(`data-dh="script:key:${DOC_STATE_ID}:`);
    // Exactly one tag, spliced into <head> — not left in the body where the document rendered.
    expect(html.match(/id="nota-doc-state/g)).toHaveLength(1);
    expect(html.indexOf('id="nota-doc-state')).toBeLessThan(
      html.indexOf("</head>")
    );
  });

  test("two documents on one page get two seeds under distinct ids", () => {
    const seeds = seedsOf(renderPage(() => <Pair />));
    expect(seeds).toHaveLength(2);
    const [[firstId, first], [secondId, second]] = seeds;
    expect(firstId).not.toBe(secondId);
    // Each converged on its OWN headings — no cross-talk through the shared head registry.
    expect(headingIds(first)).toEqual(["alpha", "beta"]);
    expect(headingIds(second)).toEqual(["gamma"]);
    // ...and each page's Toc is resolved in the bytes.
    const html = renderPage(() => <Pair />);
    expect(html).toContain(">Gamma</a>");
  });

  test("a streamed document patches the seed in from a suspended boundary", async () => {
    const html = await renderLazyPage(() => <Doc />);
    expect(headingIds(seedOf(html))).toEqual(["alpha", "beta"]);
  });

  test("the fixpoint passes leave the enclosing render's hydration keys alone", () => {
    // Solid 2 allocates hydration keys off the owner tree, so a nested renderToString no longer
    // renumbers the outer render — but it DOES install a fresh sharedConfig.context (head
    // registry + asset tracking), which renderPass saves and restores.
    const keys = (html: string) =>
      [...html.matchAll(/\s_hk=([^\s>]+)/g)].map(m => m[1]);
    const withDoc = keys(renderPage(() => <Doc />));
    expect(withDoc.length).toBeGreaterThan(0);
    // Keys are unique — no collisions from a clobbered counter.
    expect(new Set(withDoc).size).toBe(withDoc.length);
  });

  test("a document needing a third pass settles before the real render", () => {
    const seed = seedOf(renderPage(() => <SettlingDoc />));
    expect(
      seed.filter(entry => entry.kind === "echo").map(entry => entry.fact.n)
    ).toEqual([1]);
  });

  test("a non-converging document throws out of the host's render, naming the budget", () => {
    expect(() => renderPage(() => <DivergentDoc />)).toThrow(
      /did not converge in 5 passes/
    );
  });

  test("the maxPasses prop caps the passes the document spends", () => {
    expect(() => renderPage(() => <SettlingDoc maxPasses={2} />)).toThrow(
      /did not converge in 2 passes/
    );
  });

  test("setDocRenderDefaults sets the budget for the self-hosted path", () => {
    // A compiled `.nota` module calls this at module scope; SettlingDoc needs three passes.
    setDocRenderDefaults({ maxPasses: 2 });
    expect(() => renderPage(() => <SettlingDoc />)).toThrow(
      /did not converge in 2 passes/
    );
    setDocRenderDefaults({ maxPasses: 4 });
    expect(() => renderPage(() => <SettlingDoc />)).not.toThrow();
    // ...and the prop still wins over the module default.
    setDocRenderDefaults({ maxPasses: 8 });
    expect(() => renderPage(() => <SettlingDoc maxPasses={2} />)).toThrow(
      /did not converge in 2 passes/
    );
  });

  test("smart punctuation comes from the prop, else the module default", () => {
    expect(renderPage(() => <SmartDoc />)).toContain("“quoted” – dashed");
    setDocRenderDefaults({ smart: false });
    expect(renderPage(() => <SmartDoc />)).toContain('"quoted" -- dashed');
    // The prop wins over the module default.
    expect(renderPage(() => <SmartDoc smart={{ quotes: false }} />)).toContain(
      '"quoted" – dashed'
    );
  });

  test("a driver-owned render registers no head tag", () => {
    // renderDocument provides the store, so NotaDoc takes mode (a): the driver owns the passes
    // and the seed travels through `docStateScript`, not the page's <head>.
    const { html, state } = renderDocument(Doc);
    expect(html).not.toContain(DOC_STATE_ID);
    expect(headingIds(state)).toEqual(["alpha", "beta"]);
    // ...and a self-hosted render of the same document converges on the same seed.
    expect(seedOf(renderPage(() => <Doc />))).toEqual(state);
  });

  test("a page that is not a document registers nothing", () => {
    const html = renderPage(PlainRoute);
    expect(html).toContain('class="plain"');
    expect(html).not.toContain(DOC_STATE_ID);
  });

  test("a registration never leaks into the next render", () => {
    // The registry is per-render: a document page followed by a plain page must not re-emit the
    // document's snapshot.
    renderPage(() => <Doc />);
    expect(renderPage(PlainRoute)).not.toContain(DOC_STATE_ID);
  });

  test("OtherDoc alone still converges (the Pair case is not load-bearing)", () => {
    expect(headingIds(seedOf(renderPage(() => <OtherDoc />)))).toEqual([
      "gamma"
    ]);
  });
});
