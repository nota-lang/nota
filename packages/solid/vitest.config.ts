/// <reference types="vitest" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

/**
 * Two vitest projects, because Solid ships two builds selected by export conditions and
 * vite-plugin-solid compiles JSX per target:
 *
 * - **ssr** — Node env + `node` conditions → Solid's *server* build; JSX compiles with
 *   `generate: "ssr"` (+ hydration keys). Runs the renderDocument/doc-state/serialization half.
 * - **dom** — jsdom env + `browser` conditions → Solid's *client* build; JSX compiles to real
 *   DOM. Runs the Reforest behavior suite and the SSG→hydrate e2e (whose server half is built
 *   out-of-process by tests/ssg.mjs — vite-plugin-solid can only compile one flavor per project).
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
          include: ["tests/render.test.tsx"],
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
          include: ["tests/reforest.test.tsx", "tests/hydrate.test.tsx"],
          deps: inlineDeps
        }
      }
    ]
  }
}));
