/// <reference types="vitest" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import wasm from "vite-plugin-wasm";

/**
 * The ssr/dom split mirrors packages/core: Solid ships two builds selected by
 * export conditions, and one vitest project can only compile one JSX flavor.
 *
 * - **ssr** — Node env + `node` conditions → Solid's server build; covers the route wrapper's
 *   server branch (two-pass convergence) and `<NotaDocState/>`.
 * - **dom** — jsdom + `browser` conditions → Solid's client build; covers seeded hydration
 *   against server bytes produced out-of-process by tests/ssr.mjs.
 */
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  test: {
    projects: [
      {
        plugins: [solid({ ssr: true, solid: { hydratable: true } })],
        resolve: { conditions: ["node"] },
        ssr: { resolve: { conditions: ["node"] } },
        test: {
          name: "ssr",
          environment: "node",
          include: ["tests/server.test.tsx"],
          deps: inlineDeps
        }
      },
      {
        plugins: [solid({ solid: { hydratable: true } })],
        resolve: { conditions: ["browser", "development"] },
        ssr: { resolve: { conditions: ["browser", "development"] } },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/client.test.ts"],
          hookTimeout: 60_000,
          deps: inlineDeps
        }
      },
      {
        // The preset pulls in @nota-lang/vite → the in-process wasm reader.
        plugins: [wasm()],
        resolve: { conditions: ["node"] },
        test: {
          name: "config",
          environment: "node",
          include: ["tests/config.test.ts"],
          deps: inlineDeps
        }
      }
    ]
  }
}));
