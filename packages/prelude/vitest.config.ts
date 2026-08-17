/// <reference types="vitest" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

/**
 * Two vitest projects (the @nota-lang/core pattern): **ssr** (node conditions, JSX compiled
 * with generate:"ssr") drives renderDocument over full documents — headings/numbering/Toc/
 * Ref/footnotes/cite/definitions/Tex/CodeBlock; **dom** (jsdom, browser conditions) drives the
 * client-side tooltip behavior + the pure-CSR resolution semantics.
 */
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
          include: ["tests/render.test.tsx"],
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
          include: ["tests/tooltip.test.tsx", "tests/csr.test.tsx"],
          deps: inlineDeps
        }
      }
    ]
  }
}));
