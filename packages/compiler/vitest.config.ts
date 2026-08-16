/// <reference types="vitest" />
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

/**
 * One node project: the shim unit tests drive the real reader and assert the emit surface as
 * text — no framework, no DOM. `vite-plugin-wasm` + `deps.inline` because vitest transforms the
 * linked `@nota-lang/wasm` package, whose `.wasm` ESM import needs the plugin.
 */
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  plugins: [wasm()],
  resolve: { conditions: ["node"] },
  ssr: { resolve: { conditions: ["node"] } },
  test: {
    environment: "node",
    include: ["tests/*.test.ts"],
    deps: inlineDeps
  }
}));
