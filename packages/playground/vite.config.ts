import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
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
  // In tests, resolve solid-js to its browser dev build (not the SSR build), so components
  // render real DOM nodes under jsdom.
  ...(mode === "test"
    ? { resolve: { conditions: ["browser", "development"] } }
    : {}),
  test: {
    environment: "jsdom",

    include: ["tests/*.test.ts", "tests/*.test.tsx"],
    deps: {
      inline: [/^(?!.*vitest).*$/]
    }
  }
}));
