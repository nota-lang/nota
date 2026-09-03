/**
 * The server half (ssr project): a Nota route rendered the way SolidStart renders one — inside an
 * enclosing `renderToString` that also renders the document shell.
 *
 * The shape under test mirrors `StartServer`: a shell whose body holds the app subtree and then
 * `<NotaDocState/>`, so the shell's script sees the pass the route parked. What must hold:
 * forward references are resolved in the *server bytes* (the fixpoint payoff), the enclosing
 * render's hydration keys are untouched by the nested collection passes, and non-convergence is
 * loud.
 */
import { type JSX, lazy, Suspense } from "solid-js";
import { renderToString, renderToStringAsync } from "solid-js/web";
import { describe, expect, test } from "vitest";
import { notaRoute } from "../src/route";
import { NotaDocState } from "../src/shell";
import {
  DivergentDoc,
  Doc,
  PlainRoute,
  SettlingDoc
} from "./fixtures/route-doc";

/** The `StartServer` shape: app subtree, then the shell's trailing scripts. */
function renderPage(Route: () => JSX.Element): string {
  return renderToString(() => (
    <html lang="en">
      <body>
        <div id="app">
          <Route />
        </div>
        <NotaDocState />
      </body>
    </html>
  ));
}

/**
 * SolidStart's async SSR ordering: the shell renders while the lazy route is still suspended.
 * The route cannot park its document pass until a later microtask, after `<NotaDocState/>` has
 * already found an empty handoff channel.
 */
function renderLazyPage(Route: () => JSX.Element): Promise<string> {
  const LazyRoute = lazy(async () => {
    await Promise.resolve();
    return { default: Route };
  });
  return renderToStringAsync(() => (
    <html lang="en">
      <head></head>
      <body>
        <div id="app">
          <Suspense>
            <LazyRoute />
          </Suspense>
        </div>
        <NotaDocState />
      </body>
    </html>
  ));
}

const seedOf = (html: string) => {
  const m =
    /<script type="application\/json" id="nota-doc-state">(.*?)<\/script>/.exec(
      html
    );
  return m ? JSON.parse(m[1]) : undefined;
};

describe("notaRoute (server)", () => {
  test("forward references are resolved in the server bytes", () => {
    const html = renderPage(notaRoute(Doc));
    const nav = /<nav[^>]*class="toc"[^>]*>(.*?)<\/nav>/.exec(html);
    expect(nav).toBeTruthy();
    // The Toc renders before the headings exist, yet lists them.
    expect(nav?.[1]).toContain("Alpha");
    expect(nav?.[1]).toContain("Beta");
    expect(html.indexOf("<nav")).toBeLessThan(html.indexOf('id="alpha"'));
  });

  test("the shell emits the converged snapshot for the client to claim with", () => {
    const seed = seedOf(renderPage(notaRoute(Doc)));
    expect(
      seed
        .filter((entry: { kind: string }) => entry.kind === "heading")
        .map((entry: { fact: { id: string } }) => entry.fact.id)
    ).toEqual(["alpha", "beta"]);
  });

  test("an async shell emits state parked by a lazy route", async () => {
    const html = await renderLazyPage(notaRoute(Doc));
    const seed = seedOf(html);
    expect(
      seed
        .filter((entry: { kind: string }) => entry.kind === "heading")
        .map((entry: { fact: { id: string } }) => entry.fact.id)
    ).toEqual(["alpha", "beta"]);
    expect(html.match(/id="nota-doc-state"/g)).toHaveLength(1);
    expect(html.indexOf('id="nota-doc-state"')).toBeLessThan(
      html.indexOf("</head>")
    );
  });

  test("the collection passes leave the enclosing render's hydration keys alone", () => {
    // Without the sharedConfig save/restore in core's collectDocState, the nested render would
    // renumber every key after the route and the client would claim nothing.
    const keys = (html: string) =>
      [...html.matchAll(/data-hk="([^"]*)"/g)].map(m => m[1]);
    const withDoc = keys(renderPage(notaRoute(Doc)));
    expect(withDoc.length).toBeGreaterThan(0);
    // Keys are unique and monotonically allocated — no collisions from a clobbered counter.
    expect(new Set(withDoc).size).toBe(withDoc.length);
  });

  test("a document needing a third pass settles before the host's render", () => {
    // collectDocPasses spends its budget up front, so the host render is the pass that
    // reproduces the seed — the shell's check passes and the emitted snapshot is the fixpoint.
    const seed = seedOf(renderPage(notaRoute(SettlingDoc)));
    expect(
      seed
        .filter((entry: { kind: string }) => entry.kind === "echo")
        .map((entry: { fact: { n: number } }) => entry.fact.n)
    ).toEqual([1]);
  });

  test("a non-converging document throws from the shell, naming the budget", () => {
    expect(() => renderPage(notaRoute(DivergentDoc))).toThrow(
      /did not converge in 5 passes/
    );
  });

  test("maxPasses caps the passes the route spends", () => {
    expect(() => renderPage(notaRoute(SettlingDoc, { maxPasses: 2 }))).toThrow(
      /did not converge in 2 passes/
    );
  });

  test("the shell is inert on a route that is not a document", () => {
    const html = renderPage(PlainRoute);
    expect(html).toContain('class="plain"');
    expect(html).not.toContain("nota-doc-state");
  });

  test("a pass never leaks into the next render", () => {
    // The shell takes-and-clears: a document page followed by a plain page must not re-emit the
    // document's snapshot.
    renderPage(notaRoute(Doc));
    expect(renderPage(PlainRoute)).not.toContain("nota-doc-state");
  });
});
