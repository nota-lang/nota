/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Two vitest projects, because Solid ships two builds selected by export conditions (see
 * tests/conformanceMatrix.ts):
 *
 * - **ssr** — Node env + `node`/server conditions → Solid's *server* build (`renderToString`
 *   produces HTML strings). Runs the render half of the conformance matrix.
 * - **dom** — jsdom env + `browser` conditions → both frameworks' *client* builds (`hydrate`).
 *   Runs the hydrate half of the matrix, the headline integration (React `render(Doc)`), and the
 *   `bootIslands` jsdom test.
 *
 * `inlineDeps` makes vitest transform the workspace `@nota-lang/*` packages (and react/solid) rather
 * than treat them as externals — so the export conditions above actually apply to them.
 */
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  plugins: [react()],
  test: {
    projects: [
      {
        // SSR half: Node env + server conditions → Solid's *server* build (isServer=true), so
        // `renderToString` works. Vitest loads modules through its Node (SSR) runner, so the
        // governing conditions are `ssr.resolve.conditions`.
        plugins: [react()],
        resolve: { conditions: ["node"] },
        ssr: { resolve: { conditions: ["node"] } },
        test: {
          name: "ssr",
          environment: "node",
          include: ["tests/ssr.conformance.test.ts"],
          deps: inlineDeps
        }
      },
      {
        // DOM half: jsdom env + *browser* conditions → both frameworks' *client* builds
        // (Solid isServer=false), so `hydrate`/`render` work. `ssr.resolve.conditions` must carry
        // `browser` because vitest still transforms modules via its Node runner.
        plugins: [react()],
        resolve: { conditions: ["browser", "development"] },
        ssr: { resolve: { conditions: ["browser", "development"] } },
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: "tests/setup.ts",
          include: [
            "tests/dom.conformance.test.ts",
            "tests/integration.test.ts",
            "tests/bootIslands.test.ts",
            "tests/hydrateDocument.test.ts"
          ],
          deps: inlineDeps
        }
      }
    ]
  }
}));
