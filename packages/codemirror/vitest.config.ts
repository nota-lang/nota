/// <reference types="vitest" />
import { defineConfig } from "vite";

/**
 * `@nota-lang/codemirror` tests run real CM6 `EditorView`s, so they need a DOM (jsdom). `deps.inline`
 * transforms everything (workspace packages + the `file:`-linked `nota_wasm`) through vite so the
 * package's own dist/source resolve uniformly.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    deps: {
      inline: [/^(?!.*vitest).*$/]
    }
  }
});
