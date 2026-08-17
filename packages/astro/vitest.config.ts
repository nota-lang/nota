/// <reference types="vitest" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

/**
 * Three vitest projects (the ssr/dom split mirrors packages/core — Solid ships two builds
 * selected by export conditions, and vite-plugin-solid compiles JSX per target):
 *
 * - **e2e** — plain Node; runs a real `astro build` over the fixture site and asserts on the
 *   emitted HTML (Astro owns all compilation there).
 * - **ssr** — Node env + `node` conditions → Solid's *server* build; unit-tests the renderer's
 *   server entry (`check` dispatch, `renderToStaticMarkup` branches).
 * - **dom** — jsdom env + `browser` conditions → Solid's *client* build; unit-tests the
 *   renderer's client entry against server bytes built out-of-process by tests/ssg.mjs
 *   (one project can only compile one JSX flavor).
 */
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  test: {
    projects: [
      {
        test: {
          name: "e2e",
          environment: "node",
          include: ["tests/e2e.test.ts"],
          testTimeout: 240_000,
          hookTimeout: 240_000
        }
      },
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
      }
    ]
  }
}));
