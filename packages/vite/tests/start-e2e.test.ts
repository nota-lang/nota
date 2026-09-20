/**
 * Build and prerender native Nota routes through start mode; assert resolved references and seeds.
 * Inline config avoids a separate config-bundling pass over the reader's Wasm.
 */

import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { prerender } from "prerender-crawler/vite";
import { createBuilder, type Plugin, type PluginOption } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { notaFileRoutes } from "../src/file-routes";
import { notaStart } from "../src/start";

/**
 * The seed script's id: {@link DOC_STATE_ID} suffixed with the document's hydration key, since a
 * page may hold several documents. The key itself is an implementation detail of Solid's owner
 * tree, so the assertions match the prefix.
 */
const SEED_ID = /<script type="application\/json" id="nota-doc-state-[^"]*"/g;

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/start-site", import.meta.url)
);
const distDir = join(fixtureRoot, "dist");

/**
 * `process.env.NODE_ENV` is a `define` in this package's vitest config, so that member expression
 * is substituted with a literal at transform time and cannot be assigned to. This alias is the
 * same object; only the syntax differs.
 */
const env = process.env as Record<string, string | undefined>;

/** Hydration keys: Solid 2 emits them unquoted as `_hk=…` (1.x used `data-hk="…"`). */
const clean = (html: string) => html.replace(/\s*_hk=[^\s>]+/g, "");

/**
 * Concurrent lazy renders share Solid's module-global head registry and can mix page tags.
 * Crawl serially until upstream isolates render contexts.
 */
const CRAWL_CONCURRENCY = 1;

/** Every file under `dir`, as `/`-joined paths relative to it. */
function tree(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else out.push(relative(dir, p).split("\\").join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * Give each build a distinct server entry URL to bypass Node's ESM cache.
 * Start mode fixes the output directory, so repeated builds otherwise reuse the first module.
 */
function serverEntryAlias(name: string): Plugin {
  return {
    name: "test:server-entry-alias",
    apply: "build",
    applyToEnvironment: environment => environment.name === "ssr",
    writeBundle(options) {
      const dir = options.dir ?? join(fixtureRoot, "dist", "server");
      copyFileSync(join(dir, "server.js"), join(dir, name));
    }
  };
}

/**
 * Run the fixture's client + server builds and the crawl; returns the client output directory.
 *
 * NODE_ENV is pinned for the duration: Vite derives "is production" from `process.env.NODE_ENV`
 * and only fills it from `mode` when UNSET, so vitest's ambient `"test"` would otherwise ship
 * solid-js's `development` export condition into the built bundles (AGENTS.md's is-production
 * rule; the cli pins it the same way around its own programmatic builds).
 */
async function buildFixture(
  name: string,
  plugins: (serverEntry: string) => PluginOption[],
  extra: Record<string, unknown> = {}
): Promise<string> {
  rmSync(distDir, { recursive: true, force: true });
  const previous = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    const builder = await createBuilder({
      configFile: false,
      root: fixtureRoot,
      logLevel: "error",
      plugins: [
        serverEntryAlias(`${name}.js`),
        ...plugins(`dist/server/${name}.js`)
      ],
      ...extra
    });
    await builder.buildApp();
  } finally {
    if (previous === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previous;
  }
  return join(distDir, "client");
}

afterAll(() => {
  rmSync(distDir, { recursive: true, force: true });
});

describe("a static Nota site", () => {
  let files: string[] = [];
  let home = "";
  let doc = "";

  beforeAll(async () => {
    const clientDir = await buildFixture("server-plain", serverEntry => [
      // Order matters: the nota transform and the JSX compile are ahead of the file-routes
      // plugin, whose export-pruning transform is `enforce: "pre"` and must see compiled JS.
      ...notaStart({ start: { renderMode: "async" } }),
      ...notaFileRoutes(),
      prerender({
        mode: "static",
        serverEntry,
        concurrency: CRAWL_CONCURRENCY
      })
    ]);
    files = tree(clientDir);
    home = readFileSync(join(clientDir, "index.html"), "utf8");
    doc = readFileSync(join(clientDir, "doc", "index.html"), "utf8");
  }, 180_000);

  test("writes one HTML file per route module, `.nota` included", () => {
    // `routes/index.tsx` -> `/`, `routes/doc.nota` -> `/doc`, `routes/hidden.tsx` -> `/hidden`:
    // the document is a page because it is a file in the route directory, nothing else.
    expect(files).toContain("index.html");
    expect(files).toContain("doc/index.html");
    expect(home).toContain("Start fixture");
  });

  test("the unlinked route is rendered too, via announceRoutes", () => {
    // Nothing links to `/hidden`; the crawl knows about it only because `announceRoutes(Router)`
    // put it on the hint header of the response it rendered.
    expect(home).not.toContain("/hidden");
    expect(files).toContain("hidden/index.html");
  });

  test("the document rendered, reforested, into the static bytes", () => {
    expect(clean(doc)).toMatch(/<article class="nota-doc"/);
    expect(doc).toContain(
      "Nota documents converge before the bytes are written"
    );
  });

  test("the forward references converged in the shipped HTML", () => {
    const html = clean(doc);
    // `&sec-usage` is written in §1, above the `<sec-usage>` label in §2: pass 1 cannot know the
    // number, so a `2` here is a second pass that ran before the file was written.
    expect(html).toMatch(
      /<a href="#usage"[^>]*class="nota-ref[^"]*"[^>]*>2<\/a>/
    );
    // `@Toc{}` sits above both headings, so it is empty on pass 1 as well.
    const toc = /<nav class="nota-toc\s*">([\s\S]*?)<\/nav>/.exec(html);
    expect(toc?.[1]).toContain("1 Introduction");
    expect(toc?.[1]).toContain("2 Usage");
    expect(html.indexOf("<nav")).toBeLessThan(
      html.indexOf('id="introduction"')
    );
  });

  test("the document's seed is a single <head> script", () => {
    // One script, not two: the document registers the tag through `useHead`, so the registry
    // dedupes it by key rather than the page shell having to place it.
    expect(doc.match(SEED_ID)).toHaveLength(1);
    const head = /<head[^>]*>([\s\S]*?)<\/head>/.exec(doc)?.[1] ?? "";
    expect(head.match(SEED_ID)).toHaveLength(1);
    // It carries the converged snapshot the client hydrates against.
    const json = /id="nota-doc-state-[^"]*"[^>]*>([\s\S]*?)<\/script>/.exec(
      doc
    )?.[1];
    const snapshot = JSON.parse(json ?? "null") as { kind: string }[];
    expect(snapshot.filter(e => e.kind === "anchor").length).toBeGreaterThan(0);
    expect(snapshot.filter(e => e.kind === "ref").length).toBeGreaterThan(0);
    // The home page renders no document, so it carries no seed.
    expect(home).not.toContain("nota-doc-state");
  });

  test("the page is hydratable: keys, and an async module entry", () => {
    expect(doc).toMatch(/_hk=/);
    expect(doc).toMatch(/<script type="module"[^>]*\basync\b[^>]*><\/script>/);
    expect(files.some(f => f.startsWith("assets/") && f.endsWith(".js"))).toBe(
      true
    );
  });
});

describe("under a base path, with seeded pages", () => {
  let files: string[] = [];
  let clientDir = "";
  let doc = "";

  beforeAll(async () => {
    // The crawler writes each page at its URL path under the client outDir, so a crawl of
    // `/site/doc` would land in `dist/client/site/doc/`. Seeding base-prefixed paths with
    // explicit filenames — and turning link crawling off — is what puts the pages where the host
    // serves them from. This is the shape the website uses (PLAN §8.2).
    clientDir = await buildFixture(
      "server-based",
      serverEntry => [
        ...notaStart({ start: { renderMode: "async" } }),
        ...notaFileRoutes(),
        prerender({
          mode: "static",
          serverEntry,
          crawlLinks: false,
          concurrency: CRAWL_CONCURRENCY,
          pages: [
            { path: "/site/", filename: "index.html" },
            { path: "/site/doc", filename: "doc/index.html" }
          ]
        })
      ],
      { base: "/site/" }
    );
    files = tree(clientDir);
    doc = readFileSync(join(clientDir, "doc", "index.html"), "utf8");
  }, 180_000);

  test("the pages land at the outDir root, not under the base", () => {
    expect(files).toContain("index.html");
    expect(files).toContain("doc/index.html");
    expect(existsSync(join(clientDir, "site"))).toBe(false);
    expect(files.filter(f => f.startsWith("site/"))).toEqual([]);
  });

  test("asset URLs carry the base", () => {
    const urls = [
      ...doc.matchAll(/(?:src|href)="(\/[^"]*assets\/[^"]*)"/g)
    ].map(m => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.startsWith("/site/assets/")).toBe(true);
  });

  test("the document still converged", () => {
    const html = clean(doc);
    expect(html).toMatch(/<article class="nota-doc"/);
    expect(html).toMatch(/<a href="#usage"[^>]*>2<\/a>/);
    expect(doc.match(SEED_ID)).toHaveLength(1);
  });
});
