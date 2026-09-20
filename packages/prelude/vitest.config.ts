/// <reference types="vitest" />
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

/** Separate SSR and DOM projects; both need hydratable output despite Vitest's default. */
const inlineDeps = { inline: [/^(?!.*vitest).*$/] };

export default defineConfig(({ mode }) => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode)
  },
  test: {
    projects: [
      {
        plugins: [solid({ ssr: true, solid: { hydratable: true } })],
        resolve: { conditions: ["node"] },
        ssr: { resolve: { conditions: ["node"] } },
        test: {
          name: "ssr",
          environment: "node",
          include: ["tests/render.test.tsx", "tests/refs.test.ts"],
          deps: inlineDeps
        }
      },
      {
        plugins: [solid({ solid: { hydratable: true } })],
        resolve: { conditions: ["browser", "development"] },
        ssr: { resolve: { conditions: ["browser", "development"] } },
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "tests/tooltip.test.tsx",
            "tests/csr.test.tsx",
            "tests/hydrate.test.tsx"
          ],
          deps: inlineDeps
        }
      }
    ]
  }
}));
