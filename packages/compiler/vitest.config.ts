/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Two vitest projects:
 *
 * - **node** (default) — the shim unit tests (`tests/compile.test.ts`, `tests/transform`-style):
 *   spawn the reader, assert the emit surface. Node env, `node` conditions.
 * - **dom** — the *live* end-to-end (`tests/e2e.test.ts`): drive `compile()` on
 *   `integration/golden.nota` and render the reader's actual emit through `@nota-lang/runtime` +
 *   `@nota-lang/react` to the stage-5 HTML. jsdom env + *browser* conditions (so React's client
 *   build loads) and `@vitejs/plugin-react`; `inlineDeps` makes the workspace `@nota-lang/*`
 *   packages get transformed (so the conditions apply). This is the live twin of the captured-
 *   fixture e2e in `packages/react/tests/integration.test.ts`.
 */
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  test: {
    projects: [
      {
        resolve: { conditions: ["node"] },
        ssr: { resolve: { conditions: ["node"] } },
        test: {
          name: "node",
          environment: "node",
          include: ["tests/compile.test.ts", "tests/virtual.test.ts"],
          deps: inlineDeps
        }
      },
      {
        plugins: [react()],
        resolve: { conditions: ["browser", "development"] },
        ssr: { resolve: { conditions: ["browser", "development"] } },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/e2e.test.ts"],
          deps: inlineDeps
        }
      }
    ]
  }
}));
