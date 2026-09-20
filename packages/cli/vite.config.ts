import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * Build the CLI as ESM and externalize dependencies so plugins resolve peers from their own
 * installations. Framework dependencies also serve the inner builds' pinned resolver.
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
