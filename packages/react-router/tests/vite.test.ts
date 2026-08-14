/**
 * The route-module transform (`./src/vite.ts`): unit assertions on the rewrite, plus a real
 * evaluation of a transformed module — import it, render its default export through
 * react-dom/server, and check the document HTML comes out (the glue's imports resolve via the
 * vitest alias to this package's source).
 */

import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterAll, describe, expect, test } from "vitest";
import { notaRouteModules } from "../src/vite";

/** The document-mode emit shape (notation.md §Document mode) — what the nota plugin hands us. */
const EMIT = `import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime";
export let metadata = { title: "T", extra: 1 };
export default function Doc() {
\treturn decode(Fragment(h("p", {}, ["hi from the doc"])));
}
`;

type TransformFn = (
  code: string,
  id: string
) => { code: string; map: null } | null;

function transformOf(plugin = notaRouteModules()): TransformFn {
  return (plugin.transform as TransformFn).bind({});
}

describe("notaRouteModules transform", () => {
  test("rewrites a /pages/ document into a route module", () => {
    const out = transformOf()(EMIT, "/site/src/pages/home.nota");
    expect(out).not.toBeNull();
    const code = out?.code ?? "";
    expect(code).not.toContain("export default function Doc(");
    expect(code).toContain("function Doc(");
    expect(code).toContain("export default function NotaRoute()");
    expect(code).toContain("export const meta = __nota_docMeta(");
    expect(code).toContain("export { Doc };");
  });

  test("passes through non-route ids, queried ids, and non-emit content", () => {
    const t = transformOf();
    expect(t(EMIT, "/site/src/docs/home.nota")).toBeNull();
    expect(t("# raw source", "/site/src/pages/home.nota?raw")).toBeNull();
    expect(t(EMIT, "/site/src/pages/home.ts")).toBeNull();
    expect(t("export const x = 1;", "/site/src/pages/home.nota")).toBeNull();
  });

  test("a custom include filter overrides the /pages/ default", () => {
    const t = transformOf(
      notaRouteModules({ include: p => p.endsWith("route.nota") })
    );
    expect(t(EMIT, "/site/src/docs/route.nota")).not.toBeNull();
    expect(t(EMIT, "/site/src/pages/home.nota")).toBeNull();
  });

  test("a document exporting its own meta suppresses the generated one", () => {
    const emit = `export let meta = () => [];\n${EMIT}`;
    const code = transformOf()(emit, "/x/pages/p.nota")?.code ?? "";
    expect(code).not.toContain("__nota_docMeta");
    expect(code).toContain("export default function NotaRoute()");
  });
});

describe("a transformed module evaluates as a route module", () => {
  const generated = join(import.meta.dirname, "__generated-route.mjs");
  afterAll(() => {
    try {
      unlinkSync(generated);
    } catch {}
  });

  test("default export renders the document; meta derives from metadata", async () => {
    const out = transformOf()(EMIT, "/site/src/pages/home.nota");
    writeFileSync(generated, out?.code ?? "", "utf8");
    const mod = await import(/* @vite-ignore */ generated);

    const html = renderToString(createElement(mod.default));
    expect(html).toContain('class="nota-document"');
    expect(html).toContain("<p>hi from the doc</p>");

    expect(mod.meta()).toEqual([
      { title: "T" },
      { property: "og:title", content: "T" }
    ]);
    expect(mod.metadata).toEqual({ title: "T", extra: 1 });
    expect(typeof mod.Doc).toBe("function");
  });
});
