/// <reference types="vitest" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  plugins: [solid({ ssr: true, solid: { hydratable: true } })],
  resolve: { conditions: ["node"] },
  ssr: { resolve: { conditions: ["node"] } },
  test: {
    environment: "node",
    include: ["tests/*.test.ts", "tests/*.test.tsx"],
    deps: inlineDeps,
    // The e2e builds the document with two real Vite builds.
    testTimeout: 240_000,
    hookTimeout: 240_000
  }
}));
