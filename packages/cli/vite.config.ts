/// <reference types="vitest" />
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

/**
 * `@nota-lang/cli` config — the depot `script` bundle (`src/main.ts` → `dist/cli.cjs`) plus two
 * vitest projects:
 *
 * - **node** (default) — the build-pipeline tests (`tests/build.test.ts`): drive the vite-based
 *   pipeline on the shared fixtures and assert the emitted document directory (zero-`<script>` for
 *   the island-free doc, the island body + `assets/index.js` bundle + manifest for the golden, the
 *   `?url`/CSS asset flow, structural snapshots). Pure Node — the pipeline spawns the reader and
 *   runs two programmatic vite builds.
 * - **dom** — the hydration **e2e** (`tests/hydration.test.ts`): the globalSetup builds the golden
 *   into a directory once, then jsdom loads its `index.html` and executes the `assets/index.js`
 *   IIFE — asserting the island is server-present AND interactive after boot (the `Colorized`
 *   click → color change). jsdom env + browser conditions; `@vitejs/plugin-react` so any JSX in
 *   test helpers transforms.
 *
 * `inlineDeps` transforms the workspace `@nota-lang/*` packages (so conditions apply) but leaves
 * **vite itself** external — `build.ts` imports vite at test time, and its dist must load natively
 * (never through vite-node). `@nota-lang/vite` still inlines: the exclusion needs the exact
 * `node_modules/vite/` path segment.
 */
const inlineDeps = {
  inline: [/^(?!.*vitest)(?!.*node_modules\/vite\/).*$/]
};

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      formats: ["cjs"]
    },
    minify: false,
    rollupOptions: {
      // Bundle `@nota-lang/vite` + `@nota-lang/runtime` INTO `cli.cjs`: their `dist` uses bundler-style
      // **extensionless** ESM imports (e.g. `@nota-lang/vite`'s `export … from "./registry"`) that
      // Node's native ESM resolver can't load if left external. Keep external:
      //   - `vite` — ESM-only with native rolldown bindings; `build.ts` dynamic-imports it at build
      //     time (never at CLI startup), and it must not be inlined into the CJS bundle;
      //   - `@nota-lang/compiler` — a single file (no extensionless imports, so Node ESM loads it)
      //     whose `@nota-lang/wasm` import must resolve from the compiler's own node_modules;
      //     bundling would inline the wasm shim and rebase its `__dirname`-relative `.wasm` load
      //     onto `cli.cjs`'s dir, where the bytes don't live.
      // (The inner vite builds still resolve `react`/`@nota-lang/*` from this package's `node_modules`
      // via the pinned resolver at runtime, independent of what `cli.cjs` bundles.)
      external: [
        "vite",
        "@nota-lang/compiler",
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`)
      ]
    }
  },
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
          include: ["tests/build.test.ts", "tests/prelude.e2e.test.ts"],
          deps: inlineDeps,
          // The pipeline spawns the reader + runs two vite builds per build; give it room.
          testTimeout: 60000
        }
      },
      {
        plugins: [react(), wasm()],
        resolve: { conditions: ["browser", "development"] },
        ssr: { resolve: { conditions: ["browser", "development"] } },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/hydration.test.ts"],
          // Build the goldens ONCE in a Node globalSetup (fast + keeps the vite pipeline out of
          // the jsdom workers) before the jsdom tests load the emitted directories.
          globalSetup: ["tests/buildGolden.globalSetup.ts"],
          deps: inlineDeps,
          testTimeout: 60000
        }
      }
    ]
  },
  resolve: { conditions: ["node"] }
}));
