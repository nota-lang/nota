/** Verify one JSX transform handles documents, after Nota compilation. */

import { fileURLToPath } from "node:url";
import type { Plugin, ResolvedConfig } from "vite";
import { createServer, resolveConfig } from "vite";
import { describe, expect, test } from "vitest";
import { notaFileRoutes } from "../src/file-routes";
import { notaStart } from "../src/start";

/** A start-mode config needs a root component; the e2e fixture has one at `src/app.tsx`. */
const fixtureRoot = fileURLToPath(
  new URL("./fixtures/start-site", import.meta.url)
);

const names = (plugins: unknown[]): string[] =>
  plugins
    .flat(Number.POSITIVE_INFINITY)
    .map(p => (p as Plugin)?.name)
    .filter(Boolean);

const find = (plugins: readonly Plugin[], name: string): Plugin => {
  const plugin = plugins.find(p => p.name === name);
  if (!plugin) throw new Error(`no ${name} plugin`);
  return plugin;
};

type TransformFn = (
  this: unknown,
  code: string,
  id: string
) => Promise<{ code: string } | null> | { code: string } | null;

const transformOf = (plugin: Plugin): TransformFn => {
  const hook = plugin.transform;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  if (!fn) throw new Error(`${plugin.name} has no transform hook`);
  return fn as unknown as TransformFn;
};

/** Resolve a config built from `notaStart(...)`, as a site's `vite.config.ts` would. */
async function resolved(
  plugins: unknown[],
  extra: Record<string, unknown> = {}
): Promise<ResolvedConfig> {
  return await resolveConfig(
    {
      configFile: false,
      root: fixtureRoot,
      logLevel: "error",
      plugins: plugins as never,
      ...extra
    },
    "build"
  );
}

describe("the plugin array", () => {
  test("installs exactly one JSX transform", () => {
    // `solid` is @solidjs/vite-plugin's JSX-compiling plugin; its siblings (`solid:*`) are the
    // boundary/env/setup passes and do not compile JSX.
    expect(names(notaStart()).filter(n => n === "solid")).toHaveLength(1);
  });

  test('puts the .nota transform, enforce:"pre", ahead of it', () => {
    const all = names(notaStart());
    expect(all.indexOf("@nota-lang/vite")).toBeGreaterThanOrEqual(0);
    expect(all.indexOf("@nota-lang/vite")).toBeLessThan(all.indexOf("solid"));
    const transform = (notaStart() as Plugin[])[0];
    // Both plugins are `enforce: "pre"`, so Vite's sort keeps the array order between them —
    // which is the only thing making the reader run before the JSX compile.
    expect(transform.name).toBe("@nota-lang/vite");
    expect(transform.enforce).toBe("pre");
  });

  test("turns start mode on, in SSR, by default", () => {
    // `solid:ssr/setup` is start mode's server-side wiring; it is absent without `start`.
    expect(names(notaStart())).toContain("solid:ssr/setup");
  });

  test("forwards the start bag verbatim", () => {
    // `env` is a start option this preset never touches: switching it off drops the
    // `solid:start-env` plugin, which is only observable if the whole bag reached start mode.
    expect(names(notaStart())).toContain("solid:start-env");
    expect(names(notaStart({ start: { env: false } }))).not.toContain(
      "solid:start-env"
    );
  });

  test("forwards the rest of the plugin's options", () => {
    // `diagnostics: false` opts out of the dev diagnostics bridge.
    expect(names(notaStart({ solid: { diagnostics: false } }))).not.toContain(
      "solid:diagnostics"
    );
  });
});

describe("what claims which files", () => {
  test("the .nota transform compiles document source", async () => {
    const plugin = find(notaStart() as Plugin[], "@nota-lang/vite");
    const out = await transformOf(plugin).call(
      {},
      "Hello *world*",
      "/doc.nota"
    );
    expect(out?.code).toContain("export default function Doc");
  });

  test("a site's own extensions survive alongside the document ones", async () => {
    const config = await resolved(
      notaStart({ solid: { extensions: [".mdx"] } })
    );
    const jsx = transformOf(find(config.plugins, "solid"));
    const ctx = { environment: config.environments.client };
    const src = "export default () => <div>hi</div>;\n";
    // Merged, not overwritten: the JSX compile has to claim the reader's emit *and* the site's
    // own extension.
    expect(await jsx.call(ctx, src, "/x.nota")).not.toBeNull();
    expect(await jsx.call(ctx, src, "/x.mdx")).not.toBeNull();
    expect(await jsx.call(ctx, src, "/x.foo")).toBeNull();
  });

  test("custom document extensions reach the JSX compile too", async () => {
    // The reader's emit is JSX whatever the source extension was; a site compiling `.ntx`
    // documents would otherwise ship uncompiled JSX.
    const config = await resolved(
      notaStart({ nota: { extensions: [".ntx"] } })
    );
    const jsx = transformOf(find(config.plugins, "solid"));
    const ctx = { environment: config.environments.client };
    const src = "export default () => <div>hi</div>;\n";
    expect(await jsx.call(ctx, src, "/x.ntx")).not.toBeNull();
  });
});

describe("composed with the file-routes helper", () => {
  test("still exactly one JSX transform", () => {
    // `notaFileRoutes` brings its own `enforce: "pre"` transform (export pruning) but no JSX
    // compile; the invariant this file exists for has to survive the composition.
    const plugins = [...notaStart(), ...notaFileRoutes()];
    expect(names(plugins).filter(n => n === "solid")).toHaveLength(1);
    expect(names(plugins)).toContain("filesystem-routing");
  });

  test("a .nota under the routes dir reaches the manifest as a page", async () => {
    // The whole chain in one assertion: the convention claims `routes/doc.nota`, the delivery
    // plugin serializes it into `virtual:file-routes`, and the id it points at is the document
    // itself — nothing between the file and the route but a `?pick=` query.
    const server = await createServer({
      configFile: false,
      root: fixtureRoot,
      logLevel: "error",
      plugins: [...notaStart(), ...notaFileRoutes()],
      server: { middlewareMode: true },
      appType: "custom"
    });
    try {
      const manifest = (await server.ssrLoadModule("virtual:file-routes")) as {
        default: {
          path: string;
          page?: boolean;
          $component?: { src: string };
        }[];
      };
      const doc = manifest.default.find(entry => entry.path === "/doc");
      expect(doc?.page).toBe(true);
      expect(doc?.$component?.src).toMatch(
        /^src[/\\]routes[/\\]doc\.nota(\?|$)/
      );
      expect(manifest.default.map(entry => entry.path).sort()).toEqual([
        "/",
        "/doc",
        "/hidden"
      ]);
    } finally {
      await server.close();
    }
  }, 60_000);
});

describe("what the preset leaves to the site", () => {
  test("it sets no base and no client rolldown options of its own", async () => {
    // The website owns both (a GitHub Pages base path, a code-splitting group). Start mode
    // configures `environments.client` as well, so this pins that the merge keeps the site's.
    const config = await resolved(notaStart(), {
      base: "/site/",
      environments: {
        client: {
          build: {
            rolldownOptions: {
              output: {
                codeSplitting: {
                  groups: [{ name: "common", minShareCount: 2 }]
                }
              }
            }
          }
        }
      }
    });
    expect(config.base).toBe("/site/");
    const output = config.environments.client.build.rolldownOptions.output as {
      codeSplitting?: { groups?: { name: string }[] };
    };
    expect(output.codeSplitting?.groups?.[0]?.name).toBe("common");
  });

  test("a plain config gets the default base", async () => {
    expect((await resolved(notaStart())).base).toBe("/");
  });
});
