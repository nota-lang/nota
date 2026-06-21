/// <reference types="vitest" />
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * `@nota-lang/cli` config — the depot `script` bundle (`src/main.ts` → `dist/cli.cjs`) plus two
 * vitest projects:
 *
 * - **node** (default) — the build-pipeline tests (`tests/build.test.ts`): drive `buildNota` on the
 *   shared fixtures and assert the self-contained HTML (zero-`<script>` for the island-free doc, the
 *   island body + inlined bundle + manifest for the golden, structural snapshots). Pure Node — the
 *   pipeline spawns the reader, runs esbuild, and `require`s the SSR bundle.
 * - **dom** — the hydration **e2e** (`tests/hydration.test.ts`): `buildNota` the golden (Node SSR
 *   inside the required bundle), then load the emitted single FILE into jsdom and execute its inlined
 *   client `<script>` — asserting the island is server-present AND interactive after boot (the
 *   `Colorized` click → color change). jsdom env + browser conditions; `@vitejs/plugin-react` so any
 *   JSX in test helpers transforms.
 *
 * `inlineDeps` transforms the workspace `@nota-lang/*` packages (so conditions apply); the `node`
 * project keeps `node` conditions, the `dom` project uses `browser`.
 */
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

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
      //   - `esbuild` — ships native per-platform binaries that must not be bundled;
      //   - `@nota-lang/compiler` — a single file (no extensionless imports, so Node ESM loads it) that
      //     resolves the `nota_compile` binary via its **own** `import.meta.url`; bundling would rebase
      //     that to `cli.cjs`'s dir and break the binary path.
      // (The inner esbuild still resolves `react`/`@nota-lang/*` from this package's `node_modules` via
      // `nodePaths` at runtime, independent of what `cli.cjs` bundles.)
      external: [
        "esbuild",
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
        resolve: { conditions: ["node"] },
        ssr: { resolve: { conditions: ["node"] } },
        test: {
          name: "node",
          environment: "node",
          include: ["tests/build.test.ts"],
          deps: inlineDeps,
          // The pipeline spawns the reader + runs esbuild (cold start) per build; give it room.
          testTimeout: 30000
        }
      },
      {
        plugins: [react()],
        resolve: { conditions: ["browser", "development"] },
        ssr: { resolve: { conditions: ["browser", "development"] } },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/hydration.test.ts"],
          // Build the golden's single-file HTML in Node (esbuild can't run under jsdom) before the
          // jsdom test loads it.
          globalSetup: ["tests/buildGolden.globalSetup.ts"],
          deps: inlineDeps,
          testTimeout: 30000
        }
      }
    ]
  },
  resolve: { conditions: ["node"] }
}));
