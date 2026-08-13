/// <reference types="vitest" />
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

/**
 * `@nota-lang/codemirror` tests run real CM6 `EditorView`s, so they need a DOM (jsdom). `deps.inline`
 * transforms everything (workspace packages + `@nota-lang/wasm`) through vite so the package's own
 * dist/source resolve uniformly; `vite-plugin-wasm` serves the reader's `.wasm` ESM import.
 */
export default defineConfig({
  plugins: [wasm()],
  test: {
    environment: "jsdom",
    deps: {
      inline: [/^(?!.*vitest).*$/]
    }
  }
});
