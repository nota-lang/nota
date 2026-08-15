/// <reference types="vitest" />
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  plugins: [wasm()],
  test: {
    environment: "node",
    deps: {
      inline: [/^(?!.*vitest).*$/]
    }
  },
  resolve: { conditions: ["node"] }
}));
