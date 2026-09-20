/// <reference types="vitest" />

import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

/**
 * Separate server and browser JSX projects. Force hydratable: true because the plugin disables
 * it under Vitest; these suites exercise real hydration.
 */
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  test: {
    projects: [
      {
        // wasm(): the emit-surface test loads the reader through @nota-lang/compiler, whose
        // `.wasm` ESM import needs the plugin under vitest's inlining (same as the compiler's
        // own vitest config).
        plugins: [solid({ ssr: true, solid: { hydratable: true } }), wasm()],
        resolve: { conditions: ["node"] },
        ssr: { resolve: { conditions: ["node"] } },
        test: {
          name: "ssr",
          environment: "node",
          include: [
            "tests/render.test.tsx",
            "tests/emit-surface.test.ts",
            "tests/doc-host-ssr.test.tsx",
            "tests/server-write.test.ts"
          ],
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
          include: [
            "tests/reforest.test.tsx",
            "tests/hydrate.test.tsx",
            "tests/doc-host.test.ts"
          ],
          deps: inlineDeps
        }
      }
    ]
  }
}));
