import { fileURLToPath } from "node:url";
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig(({ mode }) => ({
  base: "./",
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  plugins: [solid(), wasm()],
  worker: {
    // The LSP worker (src/lsp/worker.ts) imports the bundler-target wasm reader; workers get a
    // separate plugin pipeline, so the wasm plugin must be repeated here.
    format: "es",
    plugins: () => [wasm()]
  },
  resolve: {
    // Babel requires a callable assert; Vite's browser builtin stub is not callable.
    alias: {
      assert: fileURLToPath(new URL("./src/assert-shim.cjs", import.meta.url))
    },
    // Use browser dev runtimes for jsdom tests.
    ...(mode === "test" ? { conditions: ["browser", "development"] } : {})
  },
  test: {
    environment: "jsdom",

    include: ["tests/*.test.ts", "tests/*.test.tsx"],
    deps: {
      inline: [/^(?!.*vitest).*$/]
    }
  }
}));
