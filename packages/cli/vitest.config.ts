/// <reference types="vitest" />
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

/**
 * Two projects: **build** (node) drives the pipeline directly; **hydration** (jsdom) loads the
 * document directories a Node globalSetup built and executes their client bundles — the
 * "browser loads the emitted page" acceptance test.
 *
 * Both carry `vite-plugin-wasm`: vitest inlines the linked workspace packages, so the reader
 * chain (`@nota-lang/vite` → compiler → `@nota-lang/wasm`) reaches its `.wasm` ESM import
 * through the transform pipeline (the compiler package's vitest config does the same).
 */
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(() => ({
  test: {
    projects: [
      {
        plugins: [wasm()],
        resolve: { conditions: ["node"] },
        ssr: { resolve: { conditions: ["node"] } },
        test: {
          name: "build",
          environment: "node",
          include: ["tests/build.test.ts", "tests/bin.test.ts"],
          deps: inlineDeps,
          testTimeout: 120_000,
          hookTimeout: 120_000
        }
      },
      {
        plugins: [wasm()],
        test: {
          name: "hydration",
          environment: "jsdom",
          globalSetup: ["tests/buildGolden.globalSetup.ts"],
          include: ["tests/hydration.test.ts"],
          testTimeout: 120_000,
          hookTimeout: 240_000
        }
      }
    ]
  }
}));
