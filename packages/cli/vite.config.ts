import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * `@nota-lang/cli` build config — the depot `script` bundle (`src/main.ts` → `dist/cli.js`,
 * ESM). (Tests live in `vitest.config.ts`, which vitest prefers over this file.)
 *
 * The bundle inlines NOTHING: every bare specifier stays external and resolves at runtime from
 * this package's declared dependencies, keeping the pnpm topology intact. (Inlining
 * `@nota-lang/vite` used to drag in `vite-plugin-solid`, whose load-time
 * `createRequire(import.meta.url).resolve("solid-refresh/…")` broke twice over: a CJS bundle
 * rewrites `import.meta.url` to `undefined`, and even under ESM the bundled copy can't resolve
 * solid-refresh from the CLI's node_modules.) The CLI process itself only imports
 * `@nota-lang/vite` + (dynamically) `vite`; `@nota-lang/{solid,prelude}` + `solid-js` are
 * install-time deps for the inner builds' pinned resolver, referenced only from generated entry
 * code.
 */
export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      formats: ["es"]
    },
    minify: false,
    rollupOptions: {
      // Every bare specifier (deps + node builtins) stays external.
      external: [/^[^./]/]
    }
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  resolve: { conditions: ["node"] }
}));
