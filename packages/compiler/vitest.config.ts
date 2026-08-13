/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

/**
 * Two vitest projects:
 *
 * - **node** (default) — the shim unit tests (`tests/compile.test.ts`, `tests/transform`-style):
 *   spawn the reader, assert the emit surface. Node env, `node` conditions.
 * - **dom** — the *live* end-to-end (`tests/e2e.test.ts`): drive `compile()` on
 *   `integration/golden.nota` and render the reader's actual emit through `@nota-lang/runtime` +
 *   `@nota-lang/react` to the final SSG HTML. *Browser* conditions (so React's client build loads)
 *   and `@vitejs/plugin-react`; `inlineDeps` makes the workspace `@nota-lang/*` packages get
 *   transformed (so the conditions apply). Node env — the test renders to an HTML string, no DOM;
 *   this also keeps the wasm on the SSR transform path (vitest's client environment emits a
 *   browser-fetch wasm loader that cannot run under the node pool). This is the live twin of the
 *   captured-fixture e2e in `packages/react/tests/integration.test.ts`.
 *
 * Both projects carry `vite-plugin-wasm`: `deps.inline` transforms `@nota-lang/wasm` through vite,
 * so its `.wasm` ESM import needs the plugin.
 */
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  test: {
    projects: [
      {
        plugins: [wasm()],
        resolve: { conditions: ["node"] },
        ssr: { resolve: { conditions: ["node"] } },
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/compile.test.ts",
            "tests/virtual.test.ts",
            "tests/highlight.test.ts"
          ],
          deps: inlineDeps
        }
      },
      {
        plugins: [react(), wasm()],
        resolve: { conditions: ["browser", "development"] },
        ssr: { resolve: { conditions: ["browser", "development"] } },
        test: {
          name: "dom",
          environment: "node",
          include: ["tests/e2e.test.ts"],
          deps: inlineDeps
        }
      }
    ]
  }
}));
