import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig(({ mode }) => ({
  base: "./",
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  plugins: [react(), wasm()],
  worker: {
    // The LSP worker (src/lsp/worker.ts) imports the bundler-target wasm reader; workers get a
    // separate plugin pipeline, so the wasm plugin must be repeated here.
    format: "es",
    plugins: () => [wasm()]
  },
  test: {
    environment: "jsdom",
    setupFiles: "tests/setup.ts",
    deps: {
      inline: [/^(?!.*vitest).*$/]
    }
  }
}));
