/**
 * `@nota-lang/astro` — the Astro integration for `.nota` documents (design/solid.md §SSG).
 *
 * A Nota document is *almost* a plain Solid component, but SSG-correct rendering is a property
 * of the (component, driver) pair: forward references make the document a fixpoint, so the
 * server render must be `renderDocument` (two passes + convergence + state seed) and the client
 * must be `hydrateDocument` (seed pinned through claiming) — not a host's generic
 * renderToString/hydrate. Astro's renderer API is exactly that seam: this integration registers
 * a renderer whose server entry runs the two-pass driver per island and whose client entry
 * re-seeds and claims, plus the `.nota → Solid JSX` Vite preset from `@nota-lang/vite`.
 *
 * Usage (astro.config):
 *
 * ```ts
 * import nota from "@nota-lang/astro";
 * export default defineConfig({ integrations: [nota()] });
 * ```
 *
 * Then `.nota` modules are importable components in `.astro` pages:
 * `<Doc client:load />` hydrates (one Solid app per document, keyed by a per-island renderId);
 * no directive renders zero-JS static HTML (no hydration keys, no scripts) — the `--static`
 * story, chosen per page.
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEDUPED_PACKAGES,
  type NotaPluginOptions,
  nota
} from "@nota-lang/vite";
import type { AstroIntegration } from "astro";
import type { Plugin } from "vite";

/**
 * The `@nota-lang/*` packages shipping JSX-preserved dist (compiled per target by the consumer's
 * vite-plugin-solid via the `"solid"` export condition). In SSR environments they must be
 * bundled — Node cannot execute raw JSX — and nowhere may esbuild prebundle them (optimizeDeps
 * would compile the JSX without the Solid transform).
 */
const JSX_DIST_PACKAGES = DEDUPED_PACKAGES.filter(p =>
  p.startsWith("@nota-lang/")
);

/** Options for the {@link notaAstro} integration — the `@nota-lang/vite` preset options. */
export type NotaAstroOptions = NotaPluginOptions;

/**
 * The Nota integration: registers the document renderer (server: `renderDocument` per island;
 * client: `hydrateDocument`) and installs the `.nota` Vite preset (reader transform +
 * vite-plugin-solid claiming `.nota` alongside `.jsx`/`.tsx`).
 *
 * Combining with `@astrojs/solid-js` (own Solid islands in `.astro` pages): pass
 * `{ solid: false }` here and add `".nota"` to that integration's Solid compile — the
 * document renderer dispatches exactly (the compiled emit brands its default export), so
 * non-document components fall through to other renderers.
 */
export default function notaAstro(
  options: NotaAstroOptions = {}
): AstroIntegration {
  // Entrypoints resolve relative to THIS module: identical behavior from the built dist
  // (`server.js`) and from src under a TS-transforming host (`server.ts`, the package's own
  // tests) — and no reliance on package self-reference resolution in the consumer's graph.
  const ext = import.meta.url.endsWith(".ts") ? "ts" : "js";
  const entry = (name: string) =>
    fileURLToPath(new URL(`./${name}.${ext}`, import.meta.url));
  // NODE_ENV pin state, captured in astro:config:setup and undone in astro:build:done below.
  let prevNodeEnv: string | undefined;
  let pinned = false;
  return {
    name: "@nota-lang/astro",
    hooks: {
      "astro:config:setup": ({
        addRenderer,
        command,
        config,
        updateConfig
      }) => {
        // Invariant (repo-wide, see CLAUDE.md): Vite's and Astro's own "is production" checks
        // follow process.env.NODE_ENV and only fill it from the command/mode when it is UNSET —
        // an ambient value (a test runner's "test", a CI stage's "development") rides along
        // untouched and flips solid-js's `development` export condition into the client bundle
        // this build ships (mirrors the pin in cli/src/build.ts). Ambient NODE_ENV must never
        // leak into built output, so pin it here for `astro build` only — never the dev server —
        // and restore it in astro:build:done so it doesn't leak past this integration's own
        // build (e.g. into a later in-process build sharing this Node process, as in the e2e).
        if (command === "build") {
          prevNodeEnv = process.env.NODE_ENV;
          process.env.NODE_ENV = "production";
          pinned = true;
        }
        addRenderer({
          name: "@nota-lang/astro",
          serverEntrypoint: entry("server"),
          clientEntrypoint: entry("client")
        });
        updateConfig({
          vite: {
            plugins: [...nota(options), configEnvironment()],
            // The classic ssr key, not only configEnvironment: the dev server's module runner
            // consults this one when deciding to externalize, and a natively-imported .jsx dist
            // is fatal there (build bundles regardless).
            ssr: { noExternal: [...JSX_DIST_PACKAGES] },
            server: {
              fs: {
                // Dev serves the renderer entrypoints by absolute path, and a workspace-linked
                // Nota checkout puts every @nota-lang dist outside the project root — both are
                // refused by Vite's serving allow-list unless listed. Setting fs.allow disables
                // Vite's project-root default, so the root rides along explicitly.
                allow: [
                  fileURLToPath(config.root),
                  ...notaPackageDirs(fileURLToPath(config.root))
                ]
              }
            }
          }
        });
      },
      "astro:build:done": () => {
        if (!pinned) return;
        if (prevNodeEnv === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = prevNodeEnv;
        }
        pinned = false;
      }
    }
  };
}

/**
 * The directories dev-mode file serving must reach: this package (the renderer entrypoints are
 * absolute ids into it) and the installed {@link JSX_DIST_PACKAGES} roots (under a `link:`ed
 * checkout their real paths sit outside the consumer's root). Each package resolves from the
 * consumer's root first (that graph is what dev actually serves), falling back to this package's
 * own deps; unresolvable names are skipped — nothing to allow for them.
 */
function notaPackageDirs(root: string): string[] {
  const resolvers = [
    createRequire(join(root, "package.json")),
    createRequire(import.meta.url)
  ];
  const dirs = new Set<string>([fileURLToPath(new URL("..", import.meta.url))]);
  for (const name of JSX_DIST_PACKAGES) {
    for (const req of resolvers) {
      try {
        // Entry file → dist dir → package root.
        dirs.add(join(dirname(req.resolve(name)), ".."));
        break;
      } catch {
        /* try the next resolver */
      }
    }
  }
  return [...dirs];
}

/** Per-environment config for the JSX-dist packages (see {@link JSX_DIST_PACKAGES}). */
function configEnvironment(): Plugin {
  return {
    name: "@nota-lang/astro:config-environment",
    configEnvironment(name: string) {
      if (name === "client") {
        return {
          optimizeDeps: {
            // shiki rides along: its per-language modules load dynamically by name, so the
            // optimizer discovers them mid-session and invalidates in-flight pages (504
            // "Outdated Optimize Dep" on every cold dev start). Unoptimized serving is fine.
            exclude: [...JSX_DIST_PACKAGES, "shiki"]
          }
        };
      }
      return {
        resolve: { noExternal: [...JSX_DIST_PACKAGES] },
        optimizeDeps: { exclude: JSX_DIST_PACKAGES }
      };
    }
  } as Plugin;
}
