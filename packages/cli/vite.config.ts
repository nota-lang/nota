import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * `@nota-lang/cli` build config — the depot `script` bundle (`src/main.ts` → `dist/cli.cjs`).
 * (Tests live in `vitest.config.ts`, which vitest prefers over this file.)
 */
export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      formats: ["cjs"]
    },
    minify: false,
    rollupOptions: {
      // Bundle `@nota-lang/vite` + `@nota-lang/solid` INTO `cli.cjs`: their `dist` uses
      // bundler-style **extensionless** ESM imports that Node's native ESM resolver can't load
      // if left external. Keep external:
      //   - `vite` — ESM-only with native rolldown bindings; `build.ts` dynamic-imports it at
      //     build time (never at CLI startup), and it must not be inlined into the CJS bundle;
      //   - `@nota-lang/compiler` — a single file (no extensionless imports, so Node ESM loads
      //     it) whose `@nota-lang/wasm` import must resolve from the compiler's own
      //     node_modules; bundling would inline the wasm shim and rebase its
      //     `__dirname`-relative `.wasm` load onto `cli.cjs`'s dir, where the bytes don't live.
      // (The inner vite builds still resolve `solid-js`/`@nota-lang/*` from this package's
      // `node_modules` via the pinned resolver at runtime, independent of what `cli.cjs`
      // bundles.)
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
  resolve: { conditions: ["node"] }
}));
