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

import { fileURLToPath } from "node:url";
import { nota, type NotaPluginOptions } from "@nota-lang/vite";
import type { AstroIntegration } from "astro";
import type { Plugin } from "vite";

/**
 * The `@nota-lang/*` packages shipping JSX-preserved dist (compiled per target by the consumer's
 * vite-plugin-solid via the `"solid"` export condition). In SSR environments they must be
 * bundled — Node cannot execute raw JSX — and nowhere may esbuild prebundle them (optimizeDeps
 * would compile the JSX without the Solid transform).
 */
const JSX_DIST_PACKAGES = [
  "@nota-lang/solid",
  "@nota-lang/prelude",
  "@nota-lang/paper"
];

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
  return {
    name: "@nota-lang/astro",
    hooks: {
      "astro:config:setup": ({ addRenderer, updateConfig }) => {
        addRenderer({
          name: "@nota-lang/astro",
          serverEntrypoint: entry("server"),
          clientEntrypoint: entry("client")
        });
        updateConfig({
          vite: { plugins: [...nota(options), configEnvironment()] }
        });
      }
    }
  };
}

/** Per-environment config for the JSX-dist packages (see {@link JSX_DIST_PACKAGES}). */
function configEnvironment(): Plugin {
  return {
    name: "@nota-lang/astro:config-environment",
    configEnvironment(name: string) {
      if (name === "client") {
        return { optimizeDeps: { exclude: JSX_DIST_PACKAGES } };
      }
      return {
        resolve: { noExternal: [...JSX_DIST_PACKAGES] },
        optimizeDeps: { exclude: JSX_DIST_PACKAGES }
      };
    }
  } as Plugin;
}
