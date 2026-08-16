/// <reference types="vitest" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

/** One ssr project: renderDocument drives everything (KaTeX renderToString; no DOM needed). */
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
    include: ["tests/*.test.tsx"],
    deps: inlineDeps
  }
}));
