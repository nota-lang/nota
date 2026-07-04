/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  test: {
    // Pure SSG-side rendering (KaTeX renderToString + sync shiki): node, no DOM needed.
    environment: "node"
  }
}));
