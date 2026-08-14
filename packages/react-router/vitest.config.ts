/// <reference types="vitest" />
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// jsdom + browser conditions throughout: the bridge is client-behavior code (its SSR half is
// exercised via react-dom/server's renderToString inside the same environment).
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  plugins: [react()],
  resolve: {
    conditions: ["browser", "development"],
    // One React per test run: the workspace root and this package can hold different patch
    // versions, and the server renderer throws on a mixed pair.
    dedupe: ["react", "react-dom"],
    // The route-module glue imports this package by name; resolve it to the source under test.
    alias: { "@nota-lang/react-router": join(import.meta.dirname, "src/lib.tsx") }
  },
  ssr: {
    resolve: {
      conditions: ["browser", "development"],
      dedupe: ["react", "react-dom"]
    }
  },
  test: {
    environment: "jsdom",
    include: ["tests/*.test.ts", "tests/*.test.tsx"],
    deps: inlineDeps
  }
}));
