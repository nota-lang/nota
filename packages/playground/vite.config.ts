import { fileURLToPath } from "node:url";
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
  resolve: {
    // babel-preset-solid's plugin chain (@babel/helper-module-imports) requires the node
    // builtin `assert`; vite externalizes builtins to non-callable stubs in the browser, which
    // broke in-page document compilation ("_assert is not a function"). The alias applies in
    // tests too, so vitest resolves `assert` exactly like the browser bundle instead of
    // silently falling back to node's builtin.
    alias: {
      assert: fileURLToPath(new URL("./src/assert-shim.cjs", import.meta.url))
    },
    // In tests, resolve solid-js to its browser dev build (not the SSR build), so components
    // render real DOM nodes under jsdom.
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
