/**
 * The server half (ssr project): a Nota route rendered the way SolidStart renders one — inside an
 * enclosing `renderToString` that also renders the document shell.
 *
 * The shape under test mirrors `StartServer`: a shell whose body holds the app subtree and then
 * `<NotaDocState/>`, so the shell's script sees the pass the route parked. What must hold:
 * forward references are resolved in the *server bytes* (the two-pass payoff), the enclosing
 * render's hydration keys are untouched by the nested pass 1, and non-convergence is loud.
 */
import type { JSX } from "solid-js";
import { renderToString } from "solid-js/web";
import { describe, expect, test } from "vitest";
import { notaRoute } from "../src/document";
import { NotaDocState } from "../src/server";
import { DivergentDoc, Doc, PlainRoute } from "./fixtures/doc";

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
    expect(seed.heading.map((h: { id: string }) => h.id)).toEqual([
      "alpha",
      "beta"
    ]);
  });

  test("pass 1 leaves the enclosing render's hydration keys alone", () => {
    // Without the sharedConfig save/restore in core's collectDocState, the nested render would
    // renumber every key after the route and the client would claim nothing.
    const keys = (html: string) =>
      [...html.matchAll(/data-hk="([^"]*)"/g)].map(m => m[1]);
    const withDoc = keys(renderPage(notaRoute(Doc)));
    expect(withDoc.length).toBeGreaterThan(0);
    // Keys are unique and monotonically allocated — no collisions from a clobbered counter.
    expect(new Set(withDoc).size).toBe(withDoc.length);
  });

  test("a non-converging document throws from the shell", () => {
    expect(() => renderPage(notaRoute(DivergentDoc))).toThrow(
      /did not converge/
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
